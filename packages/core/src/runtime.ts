import { serviceObserver } from './interceptors/service-observers.js';
import { isServiceInterceptor } from './interceptors/service.js';
import { ConfigService, type ConfigContext } from './config-service.js';
import { contributionPath } from './contribution-origin.js';
import { applyActionReplacements } from './replacements.js';
import { validatePluginPages } from './pages.js';
import { resolveText } from './translation.js';
import {
  ActionGroup,
  type ActionList,
  type ActionRegistration,
} from '@bitakit/core/actions';
import type {
  Contribution,
  ContributionInstaller,
  ContributionMap,
  ResolvedContribution,
  ResolvedForm,
  Field,
  FoundationConfig,
  Plugin,
  Services,
  Translator,
} from './definitions.js';
import { PluginScope, assignScopeModule } from './scope.js';
import { createServices } from './services.js';
import { createFoundationApp } from './app/access.js';
import type { FoundationApp } from './app/types.js';
import { fallbackTitle } from './conventions.js';
import {
  ActionFailure,
  evaluateFeedback,
  type Feedback,
  type MessageValues,
} from './actions/feedback.js';
import {
  adaptContribution,
  type ContributionHost,
  type DialogState,
  type FeedbackOutcome,
  type OpenableDefinition,
  type Override,
} from './contributions/index.js';
export type { DialogState } from './contributions/index.js';

function orderPlugins(plugins: readonly Plugin[]) {
  const remaining = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  if (remaining.size !== plugins.length) throw new Error('Duplicate plugin ID.');
  const ordered: Plugin[] = [];
  while (remaining.size) {
    const plugin = [...remaining.values()].find(
      (item) => item.dependencies?.every((id) => ordered.some((done) => done.id === id)) ?? true,
    );
    if (!plugin) throw new Error('Missing or cyclic plugin dependency.');
    ordered.push(plugin);
    remaining.delete(plugin.id);
  }
  return ordered;
}

/**
 * Mounts plugins into the host's ActionList. Each contribution kind is normalized by an adapter
 * in `./contributions`; the runtime owns services, translation, dialogs, ordering and cleanup.
 */
export class FoundationRuntime implements ContributionHost {
  readonly app: FoundationApp;
  readonly configuration: ConfigService;
  readonly modules: readonly Plugin[];
  private readonly actionConfigs = new Map<string, { module: string; config: ConfigContext }>();
  private ready = false;
  private readinessListeners = new Set<() => void>();
  isReady = () => this.ready;
  subscribeReady = (listener: () => void) => {
    this.readinessListeners.add(listener);
    return () => {
      this.readinessListeners.delete(listener);
    };
  };
  private setReady(ready: boolean) {
    this.ready = ready;
    this.readinessListeners.forEach((listener) => listener());
  }
  private listeners = new Set<() => void>();
  private state: DialogState | null = null;
  private registrations: {
    definition: ResolvedContribution;
    handle: ActionRegistration;
  }[] = [];
  private scopes: PluginScope[] = [];
  private extensionCleanups: (() => void)[] = [];
  private container?: ReturnType<typeof createServices>;
  private translate: Translator = (key) => key;
  private translationRevision = 0;
  private translationListeners = new Set<() => void>();
  getTranslationRevision = () => this.translationRevision;
  subscribeTranslations = (listener: () => void) => {
    this.translationListeners.add(listener);
    return () => { this.translationListeners.delete(listener); };
  };
  private notifier?: (message: string, kind: 'success' | 'failure') => unknown;
  private formFeedback = new WeakMap<DialogState, FeedbackOutcome>();
  readonly groups: Map<string, ActionGroup>;
  constructor(
    readonly actions: ActionList,
    readonly config: FoundationConfig,
    private providedServices: Partial<Services> = {},
  ) {
    this.modules = [
      { ...config, id: config.appId ?? '@foundation/app' },
      ...(config.plugins ?? []),
    ];
    this.app = createFoundationApp(this);
    this.configuration = new ConfigService(
      [{ id: config.appId ?? '@foundation/app', config: config.config }, ...(config.plugins ?? [])],
      config.configOverrides,
    );
    validatePluginPages(this.modules);
    if (new Set(config.groups ?? []).size !== (config.groups ?? []).length)
      throw new Error('Duplicate action group.');
    this.groups = new Map((config.groups ?? []).map((id) => [id, new ActionGroup(id)]));
  }
  private get appId() {
    return this.config.appId ?? '@foundation/app';
  }
  private order?: readonly Plugin[];
  /** Modules in install order: dependencies first, the application module included. */
  private moduleOrder() {
    this.order ??= orderPlugins([
      {
        id: this.appId,
        dependencies: this.config.dependencies,
        contributions: this.config.contributions,
        installs: this.config.installs,
      },
      ...(this.config.plugins ?? []),
    ]);
    return this.order;
  }
  /**
   * Declarative contributions of one kind in install order. Pure and available before mount, so
   * UI integrations can derive an initial render snapshot equivalent to the mounted state.
   */
  contributionsOf<K extends string>(
    kind: K,
  ): readonly {
    module: string;
    app: boolean;
    values: readonly (K extends keyof ContributionMap ? ContributionMap[K] : unknown)[];
  }[] {
    return this.moduleOrder().flatMap((module) => {
      const values = module.contributions?.[kind];
      return values?.length
        ? [{ module: module.id, app: module.id === this.appId, values: values as readonly any[] }]
        : [];
    });
  }
  getGroup = (entry: string | ActionGroup) => {
    const id = typeof entry === 'string' ? entry : entry.id;
    let group = this.groups.get(id);
    if (!group) {
      group = typeof entry === 'string' ? new ActionGroup(id) : entry;
      this.groups.set(id, group);
    }
    return group;
  };
  get services(): Services {
    if (!this.container) throw new Error('Foundation is not mounted.');
    return this.container.services;
  }
  getSnapshot = () => this.state;
  getServerSnapshot = () => null;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: DialogState | null) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  t = (key: string) => this.translate(key);
  text(key: string | undefined, fallback: string, values?: MessageValues): string {
    return resolveText(this.translate, key, fallback, values);
  }
  title(definition: ResolvedContribution) {
    return definition.title !== undefined
      ? this.text(definition.title, this.text(`${definition.id}.title`, definition.title))
      : this.text(
          definition.conventions !== false ? `${definition.id}.title` : undefined,
          fallbackTitle(definition),
        );
  }
  description(definition: ResolvedContribution) {
    return definition.description === undefined
      ? undefined
      : this.text(definition.description, this.text(`${definition.id}.description`, definition.description));
  }
  fieldLabel(definition: ResolvedForm, name: string, field: Field) {
    const key =
      field.label ??
      (definition.conventions !== false ? `${definition.id}.fields.${name}` : undefined);
    return this.text(key, field.label ?? name.charAt(0).toUpperCase() + name.slice(1));
  }
  /** Installs one presentation sink; disposing an older owner cannot clear its replacement. */
  setNotifier(notify: (message: string, kind: 'success' | 'failure') => unknown) {
    this.notifier = notify;
    return () => {
      if (this.notifier === notify) this.notifier = undefined;
    };
  }
  /** Presentation failures, including rejected promises, never change the Action outcome. */
  notify(message: string | false, kind: 'success' | 'failure' = 'success') {
    if (!message) return;
    try {
      Promise.resolve(this.notifier?.(message, kind)).catch(() => {});
    } catch {
      /* presentation only */
    }
  }
  translator(): Translator {
    const translate: Translator = (key, values) => this.translate(key, values);
    translate.has = (key) => this.translate.has?.(key) ?? true;
    return translate;
  }
  override(id: string): Override {
    return this.config.actionOverrides?.[id];
  }
  dialog() {
    return this.state;
  }
  openDialog(definition: OpenableDefinition, input: unknown) {
    this.publish({ definition, input, token: Symbol() });
  }
  rememberFormFeedback(state: DialogState, outcome: FeedbackOutcome) {
    this.formFeedback.set(state, outcome);
  }
  feedback<C>(
    definition: ResolvedContribution,
    kind: 'success' | 'failure',
    option: Feedback<C>,
    context: C,
  ): FeedbackOutcome {
    const value = evaluateFeedback(option, context);
    if (value === false) return { message: false, closeDialog: true };
    try {
      return {
        message:
          (value.message ? this.text(value.message, this.text(`${definition.id}.${kind}`, value.message, value.values), value.values) : value.message) ??
          (value.messageKey ? this.text(value.messageKey, value.messageKey, value.values) : false),
        closeDialog: value.closeDialog ?? true,
      };
    } catch {
      return { message: false, closeDialog: true };
    }
  }

  /** Public submission path; the internal submit registration owns validation and pending guards. */
  async submitForm(definition: ResolvedForm, values: Record<string, string>) {
    const state = this.state;
    if (state?.definition !== definition) return;
    const outcome = await this.actions.execute(`${definition.id}.submit`, values);
    if (outcome.status !== 'completed' || this.state !== state) return;
    const feedback = this.formFeedback.get(state);
    this.formFeedback.delete(state);
    if (!feedback) return;
    this.notify(feedback.message);
    if (feedback.closeDialog) this.close();
  }
  setTranslations(translate: Translator) {
    this.translate = translate;
    this.translationRevision += 1;
    this.translationListeners.forEach((listener) => listener());
    for (const { definition, handle } of this.registrations) {
      handle.update({
        title: this.title(definition),
        description: this.description(definition),
        tooltip:
          definition.tooltip === undefined
            ? undefined
            : this.text(definition.tooltip, this.text(`${definition.id}.tooltip`, definition.tooltip)),
      });
    }
  }
  close = () => {
    if (
      this.state?.definition.kind === 'form' &&
      this.actions.get(`${this.state.definition.id}.submit`)?.pending
    )
      return;
    this.publish(null);
  };
  mount() {
    if (this.container) throw new Error('Foundation is already mounted.');
    const selected = applyActionReplacements(this.config.plugins ?? [], this.config.actions ?? []);
    const plugins = orderPlugins([
      {
        id: this.config.appId ?? '@foundation/app',
        dependencies: this.config.dependencies,
        setup: this.config.setup,
        actions: selected.actions,
        services: this.config.services,
        config: this.config.config,
        contributions: this.config.contributions,
        installs: this.config.installs,
      },
      ...selected.plugins,
    ]);
    const serviceModules = new Map(
      plugins.flatMap((plugin) =>
        (plugin.services ?? []).map((service) => [service, plugin.id] as const),
      ),
    );
    this.container = createServices(
      plugins.flatMap((plugin) => plugin.services ?? []),
      this.providedServices,
      (definition) => this.configuration.context(serviceModules.get(definition)!),
      serviceObserver(this.modules),
    );
    try {
      this.extensionCleanups.push(
        this.actions.subscribeExecution((event) => {
          if (
            event.phase === 'failed' &&
            event.context.get() &&
            event.error instanceof ActionFailure
          )
            this.notify(event.error.feedback, 'failure');
        }),
      );
      this.connectTranslation();
      this.installInterceptors(plugins);
      for (const plugin of plugins) {
        const scope = new PluginScope(this.actions, this.groups);
        assignScopeModule(scope, { id: plugin.id, app: plugin.id === this.appId });
        this.scopes.push(scope);
      }
      this.installContributions(plugins);
      const observed = new Set<string>();
      plugins.forEach((plugin, index) => {
        for (const contribution of plugin.actions ?? [])
          this.install(this.scopes[index], contribution, observed, plugin.id);
      });
      this.observe(observed);
      plugins.forEach((plugin, index) => {
        const scope = this.scopes[index];
        const cleanup = plugin.setup?.({ app: scope, services: this.services });
        if (cleanup) scope.own(cleanup);
      });
    } catch (error) {
      this.unmount();
      throw error;
    }
    this.setReady(true);
    return () => this.unmount();
  }
  /** Routes each contribution kind to the one module that installs it; cleanup stays with the contributor. */
  private installContributions(plugins: readonly Plugin[]) {
    const installers = new Map<string, { module: string; install: ContributionInstaller<any> }>();
    for (const plugin of plugins)
      for (const [kind, install] of Object.entries(plugin.installs ?? {})) {
        if (!install) continue;
        const existing = installers.get(kind);
        if (existing)
          throw new Error(
            `Contribution kind "${kind}" is installed by both "${existing.module}" and "${plugin.id}".`,
          );
        installers.set(kind, { module: plugin.id, install });
      }
    for (const plugin of plugins)
      for (const [kind, values] of Object.entries(plugin.contributions ?? {}))
        if (values?.length && !installers.has(kind))
          throw new Error(
            `"${plugin.id}" contributes "${kind}", but no enabled plugin installs that kind.`,
          );
    for (const [kind, { install }] of installers)
      plugins.forEach((plugin, index) => {
        const values = plugin.contributions?.[kind];
        if (!values?.length) return;
        const cleanup = install(values, {
          module: plugin.id,
          app: plugin.id === this.appId,
          services: this.services,
        });
        if (cleanup) this.scopes[index].own(cleanup);
      });
  }
  private connectTranslation() {
    const i18n = this.services.i18n;
    if (!i18n) return;
    this.setTranslations(i18n.translate);
    this.extensionCleanups.push(i18n.subscribe(() => this.setTranslations(i18n.translate)));
  }
  private installInterceptors(plugins: readonly Plugin[]) {
    const entries = [
      ...(this.config.interceptors ?? []).map((definition) => ({
        definition,
        module: this.config.appId ?? '@foundation/app',
        global: !isServiceInterceptor(definition) && definition.scope !== 'plugin',
      })),
      ...plugins.flatMap((plugin) =>
        (plugin.interceptors ?? []).map((definition) => ({
          definition,
          module: plugin.id,
          global: !isServiceInterceptor(definition) && definition.scope === 'global',
        })),
      ),
    ].sort((a, b) => (a.definition.order ?? 0) - (b.definition.order ?? 0));
    for (const { definition, module, global } of entries) {
      if (isServiceInterceptor(definition)) continue;
      if ('create' in definition) this.requireServices(definition.requires);
      const interceptor =
        'create' in definition
          ? definition.create({
              services: this.services,
              translate: this.translator(),
              config: this.configuration.context(module),
            })
          : definition;
      this.extensionCleanups.push(
        this.actions.use({
          before: (context) => {
            const target = this.actionConfigs.get(context.id);
            if (!global && target?.module !== module) return;
            return interceptor.before({
              ...context,
              config: target?.config ?? this.configuration.context(module),
            });
          },
        }),
      );
    }
  }
  private requireServices(ids: readonly string[] = []) {
    for (const id of ids)
      if (!Object.hasOwn(this.services, id)) throw new Error(`Missing service "${id}".`);
  }
  /** One path for every kind: adapt, check dependencies, register, remember for re-translation. */
  private install(
    scope: PluginScope,
    contribution: Contribution,
    observed: Set<string>,
    module: string,
  ) {
    const path =
      (typeof contribution === 'object' ? contribution.configPath : undefined) ??
      contributionPath(contribution) ??
      (typeof contribution === 'object' && contribution.id ? contribution.id.split('.') : []);
    const config = this.configuration.context(module, path);
    const adapted = adaptContribution(contribution, this, config);
    this.requireServices(adapted.requires);
    for (const id of adapted.watch) {
      const service = (this.services as unknown as Record<string, { subscribe?: unknown }>)[id];
      if (!service || typeof service.subscribe !== 'function')
        throw new Error(`Observed service "${id}" must provide subscribe(listener).`);
      observed.add(id);
    }
    for (const registration of adapted.registrations) {
      this.actionConfigs.set(registration.id, { module, config });
      const handle = registration.instance
        ? this.actions.add(registration.id, registration.instance, registration.placement)
        : this.actions.register(registration.definition, registration.placement);
      scope.own(handle.unregister);
      this.registrations.push({ definition: adapted.definition, handle });
    }
  }
  private observe(observed: Set<string>) {
    for (const id of observed) {
      const service = (
        this.services as unknown as Record<string, { subscribe(listener: () => void): () => void }>
      )[id];
      this.extensionCleanups.push(service.subscribe(() => this.actions.refresh()));
    }
    // Cover synchronous initial emissions and sources changed during setup.
    if (observed.size) this.actions.refresh();
  }
  private unmount() {
    this.setReady(false);
    const errors: unknown[] = [];
    for (const cleanup of this.extensionCleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    for (const scope of this.scopes.splice(0).reverse()) {
      try {
        scope.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      this.container?.dispose();
    } catch (error) {
      errors.push(error);
    }
    this.container = undefined;
    this.registrations = [];
    this.actionConfigs.clear();
    this.publish(null);
    if (errors.length) throw new AggregateError(errors, 'Foundation cleanup failed.');
  }
}
