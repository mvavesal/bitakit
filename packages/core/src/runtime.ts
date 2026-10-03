import { EventService, createEventScope } from './events/service.js';
import { ConfigService, type ConfigContext } from './config-service.js';
import {
  contributionPath,
  contributionSource,
  preserveContributionPath,
  setContributionPath,
} from './contribution-origin.js';
import { ServiceNames, type ServiceEntry, type ServiceRequester } from './service-names.js';
import { FoundationStartupError, isFoundationStartupError, moduleLabel } from './startup-error.js';
import { findPluginPage, validatePluginPages } from './pages.js';
import { projectedDestination, type Destination } from './destinations.js';
import { resolveText } from './translation.js';
import {
  ActionGroup,
  createActionList,
  type ActionList,
  type ActionRegistration,
  type ActionSnapshot,
} from '@bitakit/core/actions';
import type {
  ActionSpec,
  ContributionInstaller,
  ContributionMap,
  ResolvedContribution,
  FoundationConfig,
  Plugin,
  PluginPageDefinition,
  PluginView,
  ProviderDefinition,
  ServiceDefinition,
  Services,
  Translator,
} from './definitions.js';
import type { Events } from './events/types.js';
import { PluginScope, assignScopeModule } from './scope.js';
import { SettingsStore, type SettingEntry } from './settings/store.js';
import { createSettingsAccess, type SettingsAccess } from './settings/access.js';
import { createLocalSettingsStorage, type SettingsStorage } from './settings/storage.js';
import { isSettingsDefinition, type SettingSpec } from './settings/define.js';
import type { AuthService } from './contracts.js';
import { createServices, type Observable } from './services.js';
import { createFoundationApp } from './app/access.js';
import type { FoundationApp } from './app/types.js';
import { fallbackTitle, resolveContribution } from './conventions.js';
import {
  isActionFailure,
  evaluateFeedback,
  type Feedback,
  type MessageValues,
} from './actions/feedback.js';
import {
  adaptAction,
  type ContributionHost,
  type DialogState,
  type FeedbackOutcome,
  type OpenableDefinition,
  type Override,
} from './contributions/index.js';
import {
  isServiceInterceptor,
  matchesTarget,
  type ActionInterceptorSpec,
  type InterceptorSpec,
} from './interceptors/define.js';
import { serviceObserver } from './interceptors/service-observers.js';
import type { Confirmation } from './confirmation.js';
export type { DialogState } from './contributions/index.js';

/** A plugin after normalization: records resolved to arrays with IDs, `ui` merged with the legacy fields. */
export type NormalizedPlugin = Omit<Plugin, 'services' | 'actions'> & {
  readonly id: string;
  readonly services: readonly (ServiceDefinition<any> & { id: string })[];
  readonly actions: readonly ResolvedContribution[];
  readonly pages: readonly PluginPageDefinition[];
  readonly views: readonly PluginView[];
  readonly providers: readonly ProviderDefinition[];
};

function attributed(error: unknown, plugin: string, what: string, appId: string) {
  if (isFoundationStartupError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new FoundationStartupError(
    `${what} in ${moduleLabel(plugin, appId)}: ${message}`,
    plugin,
    {
      cause: error,
      app: plugin === appId,
    },
  );
}

function normalize(module: Plugin, appId: string): NormalizedPlugin {
  const id = module.id;
  const isApp = id === appId;
  try {
    const services: (ServiceDefinition<any> & { id: string })[] = Array.isArray(module.services)
      ? module.services.map((service) => {
          // A contract key doubles as the ID of an array entry, as provideService did before.
          const serviceId = service.id ?? (service.provides as string | undefined);
          if (!serviceId)
            throw new Error(
              'A service in an array needs an id. Prefer a record: services: { items: service }.',
            );
          return preserveContributionPath(service, {
            ...service,
            id: serviceId,
          }) as ServiceDefinition<any> & { id: string };
        })
      : Object.entries((module.services ?? {}) as Record<string, ServiceDefinition<any>>).map(
          ([key, service]) => ({
            ...service,
            id: service.id ?? (isApp ? key : `${id}.${key}`),
          }),
        );
    const actions: ResolvedContribution[] = Array.isArray(module.actions)
      ? module.actions.map((action) => {
          const resolved = resolveContribution(action);
          if (!contributionPath(resolved))
            setContributionPath(
              resolved,
              resolved.id.startsWith(`${id}.`)
                ? resolved.id.slice(id.length + 1).split('.')
                : resolved.id.split('.'),
              contributionSource(resolved),
            );
          return resolved;
        })
      : Object.entries((module.actions ?? {}) as Record<string, ActionSpec<any, any>>).map(
          ([key, action]) => {
            const resolved = resolveContribution(action, isApp ? key : `${id}.${key}`);
            if (!contributionPath(resolved))
              setContributionPath(resolved, key.split('.'), contributionSource(resolved));
            return resolved;
          },
        );
    if (module.settings !== undefined && !isSettingsDefinition(module.settings))
      throw new Error('settings must be declared with defineSettings({ ... }) in settings.ts.');
    return {
      ...module,
      id,
      services,
      actions,
      pages: module.ui?.pages ?? [],
      views: module.ui?.slots ?? [],
      providers: module.ui?.providers ?? [],
    };
  } catch (error) {
    throw attributed(error, id, 'Plugin definition', appId);
  }
}

function orderPlugins(plugins: readonly NormalizedPlugin[], appId: string) {
  const remaining = new Map<string, NormalizedPlugin>();
  for (const plugin of plugins) {
    if (remaining.has(plugin.id))
      throw new FoundationStartupError(
        `Plugin ID "${plugin.id}" is used twice. Rename one plugin folder or set a different id in plugin.config.ts.`,
        plugin.id,
        { app: plugin.id === appId },
      );
    remaining.set(plugin.id, plugin);
  }
  const ordered: NormalizedPlugin[] = [];
  while (remaining.size) {
    const plugin = [...remaining.values()].find((item) =>
      (item.dependencies ?? []).every((id) => ordered.some((done) => done.id === id)),
    );
    if (plugin) {
      ordered.push(plugin);
      remaining.delete(plugin.id);
      continue;
    }
    for (const item of remaining.values()) {
      const missing = (item.dependencies ?? []).find(
        (id) => !plugins.some((candidate) => candidate.id === id),
      );
      if (missing)
        throw new FoundationStartupError(
          `Plugin "${item.id}" depends on "${missing}", which is not installed or is disabled. Known plugins: ${plugins.map((candidate) => candidate.id).join(', ')}.`,
          item.id,
          { app: item.id === appId },
        );
    }
    const path: string[] = [];
    let current = remaining.keys().next().value!;
    while (!path.includes(current)) {
      path.push(current);
      current = (remaining.get(current)!.dependencies ?? []).find((id) => remaining.has(id))!;
    }
    const cycle = [...path.slice(path.indexOf(current)), current];
    throw new FoundationStartupError(
      `Plugin dependency cycle: ${cycle.join(' → ')}. Break it with an event or a shared service that both can require.`,
      cycle[0],
      { app: cycle[0] === appId },
    );
  }
  return ordered;
}

type Deferred = { promise: Promise<void>; resolve(): void; reject(error: unknown): void };
function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

/**
 * Mounts plugins into the host's ActionList. The runtime owns services, events, translation,
 * dialogs, confirmation, ordering and cleanup; every contribution goes through one adapter.
 */
export class FoundationRuntime implements ContributionHost {
  readonly app: FoundationApp;
  readonly events: EventService;
  readonly configuration: ConfigService;
  readonly modules: readonly NormalizedPlugin[];
  readonly groups: Map<string, ActionGroup>;
  /** The owner of setting values; `useSetting` and the `settings` contexts read from it. */
  readonly settings: SettingsStore;
  /** Typed handles under plugin namespaces, the `settings` every context receives. */
  readonly settingsAccess: SettingsAccess;
  private defaultStorage?: SettingsStorage;
  private readonly appId: string;
  private readonly order: readonly NormalizedPlugin[];
  private readonly names: ServiceNames;
  private readonly actionConfigs = new Map<string, { module: string; config: ConfigContext }>();
  private mounted = false;
  private readinessListeners = new Set<() => void>();
  private readyDeferred = deferred();
  private startController?: AbortController;
  isReady = () => this.mounted;
  subscribeReady = (listener: () => void) => {
    this.readinessListeners.add(listener);
    return () => {
      this.readinessListeners.delete(listener);
    };
  };
  /** Resolves when every service's `onStart` has completed; rejects with the attributed startup error. */
  get ready(): Promise<void> {
    return this.readyDeferred.promise;
  }
  private setReady(ready: boolean) {
    this.mounted = ready;
    this.readinessListeners.forEach((listener) => listener());
    // Presentation may read app.ready.
    if (this.container) this.actions.refresh();
  }
  private listeners = new Set<() => void>();
  private state: DialogState | null = null;
  private registrations: { definition: ResolvedContribution; handle: ActionRegistration }[] = [];
  private scopes: PluginScope[] = [];
  private extensionCleanups: (() => void)[] = [];
  private container?: ReturnType<typeof createServices>;
  private view?: Services;
  private translate: Translator = (key) => key;
  private translationRevision = 0;
  private translationListeners = new Set<() => void>();
  getTranslationRevision = () => this.translationRevision;
  subscribeTranslations = (listener: () => void) => {
    this.translationListeners.add(listener);
    return () => {
      this.translationListeners.delete(listener);
    };
  };
  private notifier?: (message: string, kind: 'success' | 'failure') => unknown;
  private confirmHandler?: (request: Confirmation) => Promise<boolean> | boolean;
  private confirmWarned = false;

  constructor(
    readonly actions: ActionList,
    readonly config: FoundationConfig,
    private providedServices: Readonly<Record<string, unknown>> = {},
  ) {
    this.appId = config.appId ?? 'app';
    const { plugins = [], appId: _appId, ...appModule } = config;
    this.modules = [
      normalize({ ...appModule, id: this.appId } as Plugin, this.appId),
      ...plugins.map((plugin) => normalize(plugin, this.appId)),
    ];
    this.order = orderPlugins(this.modules, this.appId);
    this.events = new EventService(config.onEventError);
    for (const module of this.modules)
      if (module.events) {
        try {
          this.events.declare(module.id, module.events);
        } catch (error) {
          throw attributed(error, module.id, 'Event declaration', this.appId);
        }
      }
    this.names = new ServiceNames(this.serviceEntries(), this.appId);
    try {
      this.settings = new SettingsStore(this.settingEntries(), () => this.storage());
      this.settingsAccess = createSettingsAccess(this.settings);
    } catch (error) {
      throw attributed(error, this.appId, 'Settings', this.appId);
    }
    this.app = createFoundationApp(this);
    try {
      this.configuration = new ConfigService(
        this.modules.map((module) => ({ id: module.id, config: module.config })),
        config.configOverrides,
      );
    } catch (error) {
      throw attributed(error, this.appId, 'Configuration', this.appId);
    }
    validatePluginPages(
      this.modules,
      new Set(
        Object.keys(this.modules.find((module) => module.id === this.appId)?.ui?.layouts ?? {}),
      ),
    );
    const groups = config.groups ?? [];
    const duplicate = groups.find((id, index) => groups.indexOf(id) !== index);
    if (duplicate) throw new Error(`Action group "${duplicate}" is listed twice in groups.`);
    this.groups = new Map(groups.map((id) => [id, new ActionGroup(id)]));
  }

  private serviceEntries(): ServiceEntry[] {
    const entries: ServiceEntry[] = Object.keys(this.providedServices).map((id) => ({
      id,
      aliases: [],
      plugin: this.appId,
    }));
    for (const module of this.modules) {
      for (const service of module.services)
        entries.push({
          id: service.id,
          aliases: [service.exposeAs, service.provides as string | undefined].filter(
            (alias): alias is string => typeof alias === 'string',
          ),
          plugin: module.id,
        });
    }
    return entries;
  }
  private settingEntries(): SettingEntry[] {
    const entries: SettingEntry[] = [];
    for (const module of this.modules)
      for (const [name, spec] of Object.entries(
        (module.settings?.settings ?? {}) as Record<string, SettingSpec<any>>,
      ))
        entries.push({
          key: module.id === this.appId ? name : `${module.id}.${name}`,
          plugin: module.id,
          name,
          spec,
        });
    return entries;
  }
  /** The `settings.storage` contract when a service provides it, otherwise browser storage. */
  private storage(): SettingsStorage {
    const name = 'settings.storage';
    if (this.hasService(name))
      return this.container!.services[this.names.key(name)] as SettingsStorage;
    return (this.defaultStorage ??= createLocalSettingsStorage());
  }
  /**
   * Loads settings for the identity the `auth` contract reports. Runs after setup and whenever
   * an observed service changes, so no extra subscription is needed; without authentication the
   * anonymous device identity applies. Never blocks readiness.
   */
  private syncIdentity() {
    if (!this.container) return;
    const auth = this.hasService('auth')
      ? (this.container.services[this.names.key('auth')] as Partial<AuthService>)
      : undefined;
    const snapshot = typeof auth?.getSnapshot === 'function' ? auth.getSnapshot() : undefined;
    if (snapshot?.pending) return;
    const next = {
      userId: snapshot?.user?.id,
      organizationId: snapshot?.organizationId ?? undefined,
    };
    const current = this.settings.currentIdentity;
    if (
      this.settings.isActive &&
      next.userId === current.userId &&
      next.organizationId === current.organizationId
    )
      return;
    void this.settings.activate(next);
  }
  /** Every name (ID and aliases) that resolves to a container key. */
  private aliasesOf(id: string): readonly string[] {
    return this.names.names().filter((name) => name !== id && this.names.key(name) === id);
  }

  /** Declarative contributions of one kind in install order; available before mount. */
  contributionsOf<K extends string>(
    kind: K,
  ): readonly {
    module: string;
    app: boolean;
    values: readonly (K extends keyof ContributionMap ? ContributionMap[K] : unknown)[];
  }[] {
    return this.order.flatMap((module) => {
      const values = module.contributions?.[kind];
      return values?.length
        ? [{ module: module.id, app: module.id === this.appId, values: values as readonly any[] }]
        : [];
    });
  }
  /** What a URL Action leads to and which plugin owns it, from existing registrations. */
  destinationOf(action: Pick<ActionSnapshot, 'id' | 'href' | 'metadata'>): Destination | undefined {
    const owner = (plugin?: string) => (plugin && plugin !== this.appId ? { plugin } : {});
    const projected = projectedDestination(action.metadata);
    if (projected) return { kind: projected.kind, ...owner(projected.plugin) };
    const href = action.href;
    if (!href?.startsWith('/') || href.startsWith('//')) return undefined;
    const page = findPluginPage(this.modules, href.split(/[?#]/)[0]);
    return { kind: 'page', ...owner(page ? page.plugin : this.ownerOf(action.id)) };
  }
  private ownerOf(id: string): string | undefined {
    const module = this.actionConfigs.get(id)?.module;
    return module && module !== this.appId ? module : undefined;
  }
  /** One group per ID; the first title given for an ID is kept. */
  getGroup = (entry: string | ActionGroup) => {
    const id = typeof entry === 'string' ? entry : entry.id;
    const group = this.groups.get(id);
    if (
      group &&
      (typeof entry === 'string' || group.title !== undefined || entry.title === undefined)
    )
      return group;
    const next = typeof entry === 'string' ? new ActionGroup(id) : entry;
    this.groups.set(id, next);
    return next;
  };

  /** The live service tree every contribution sees. */
  get services(): Services {
    if (!this.view) throw new Error('Foundation is not mounted.');
    return this.view;
  }
  servicesIfMounted(): Services | undefined {
    return this.mounted ? this.view : undefined;
  }
  hasService(name: string): boolean {
    return (
      !!this.container &&
      this.names.known(name) &&
      Object.hasOwn(this.container.services, this.names.key(name))
    );
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
    if (typeof definition.title === 'function') return fallbackTitle(definition);
    return definition.title !== undefined
      ? this.text(definition.title, this.text(`${definition.id}.title`, definition.title))
      : this.text(`${definition.id}.title`, fallbackTitle(definition));
  }
  description(definition: ResolvedContribution) {
    if (typeof definition.description === 'function') return undefined;
    return definition.description === undefined
      ? this.text(`${definition.id}.description`, '') || undefined
      : this.text(
          definition.description,
          this.text(`${definition.id}.description`, definition.description),
        );
  }
  tooltip(definition: ResolvedContribution) {
    if (typeof definition.tooltip === 'function' || definition.tooltip === undefined)
      return undefined;
    return this.text(definition.tooltip, this.text(`${definition.id}.tooltip`, definition.tooltip));
  }
  /** Installs one presentation sink; disposing an older owner cannot clear its replacement. */
  setNotifier(notify: (message: string, kind: 'success' | 'failure') => unknown) {
    this.notifier = notify;
    return () => {
      if (this.notifier === notify) this.notifier = undefined;
    };
  }
  notify(message: string | false, kind: 'success' | 'failure' = 'success') {
    if (!message) return;
    try {
      Promise.resolve(this.notifier?.(message, kind)).catch(() => {});
    } catch {
      /* presentation only */
    }
  }
  /** Installs the host's confirmation dialog for actions with `confirm`. */
  setConfirm(handler: (request: Confirmation) => Promise<boolean> | boolean) {
    this.confirmHandler = handler;
    return () => {
      if (this.confirmHandler === handler) this.confirmHandler = undefined;
    };
  }
  async confirm(request: Confirmation): Promise<boolean> {
    if (this.confirmHandler) return this.confirmHandler(request);
    if (!this.confirmWarned) {
      this.confirmWarned = true;
      console.warn(
        '[bitakit] An action asks for confirmation, but no confirmation handler is installed. Proceeding without asking.',
      );
    }
    return true;
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
  /**
   * Resolves a feedback option. Without one, the `<id>.success` / `<id>.failure` catalog keys
   * apply; a failure without any message shows the error in development and a generic text
   * in production. Feedback callbacks can never turn a success into a failure.
   */
  feedback<C>(
    definition: ResolvedContribution,
    kind: 'success' | 'failure',
    option: Feedback<C> | undefined,
    context: C & { error?: unknown },
  ): FeedbackOutcome {
    if (option === false) return { message: false, closeDialog: true };
    const key = `${definition.id}.${kind}`;
    if (option === undefined) {
      if (this.translate.has?.(key)) return { message: this.text(key, key), closeDialog: true };
      if (kind === 'failure') return { message: defaultFailure(context.error), closeDialog: false };
      return { message: false, closeDialog: true };
    }
    const value = evaluateFeedback(option, context);
    if (value === false) return { message: false, closeDialog: true };
    try {
      const message =
        (value.message
          ? this.text(value.message, this.text(key, value.message, value.values), value.values)
          : value.message) ??
        (value.messageKey
          ? this.text(value.messageKey, value.messageKey, value.values)
          : undefined);
      if (message === undefined) {
        if (this.translate.has?.(key))
          return { message: this.text(key, key), closeDialog: value.closeDialog ?? true };
        return {
          message: kind === 'failure' ? defaultFailure(context.error) : false,
          closeDialog: value.closeDialog ?? kind !== 'failure',
        };
      }
      return { message, closeDialog: value.closeDialog ?? true };
    } catch {
      return { message: false, closeDialog: true };
    }
  }
  setTranslations(translate: Translator) {
    this.translate = translate;
    this.translationRevision += 1;
    this.translationListeners.forEach((listener) => listener());
    for (const { definition, handle } of this.registrations)
      handle.update({
        title: this.title(definition),
        description: this.description(definition),
        tooltip: this.tooltip(definition),
      });
  }
  close = () => {
    this.publish(null);
  };

  mount() {
    if (this.container) throw new Error('Foundation is already mounted.');
    const plugins = this.order;
    const owners = new Map<ServiceDefinition<any>, string>();
    for (const plugin of plugins)
      for (const service of plugin.services) owners.set(service, plugin.id);
    const interceptors: InterceptorSpec[] = plugins.flatMap((plugin) => plugin.interceptors ?? []);
    this.container = createServices(
      plugins.flatMap((plugin) => plugin.services),
      this.providedServices,
      (definition) => this.configuration.context(owners.get(definition) ?? this.appId),
      serviceObserver(interceptors, (id) => this.aliasesOf(id)),
      this.events,
      {
        names: this.names,
        appId: this.appId,
        moduleOf: (definition) => owners.get(definition) ?? this.appId,
        sourceOf: (definition) => contributionSource(definition),
      },
      (definition) => definition.id!,
      this.settingsAccess,
    );
    // Contexts exist only after the container does; readiness is the public facade's concern.
    this.view = this.names.tree(this.container.services);
    const moduleEvents = new Map<string, Events>();
    try {
      this.extensionCleanups.push(
        this.actions.subscribeExecution((event) => {
          if (event.phase === 'failed' && event.context.get() && isActionFailure(event.error))
            this.notify(event.error.feedback, 'failure');
        }),
      );
      for (const plugin of plugins) {
        const scope = createEventScope(this.events, plugin.id);
        this.extensionCleanups.push(scope.dispose);
        moduleEvents.set(plugin.id, scope.events);
      }
      this.connectTranslation();
      this.installInterceptors(plugins);
      const composed = Object.freeze(
        plugins
          .filter((plugin) => plugin.id !== this.appId)
          .map((plugin) => Object.freeze({ id: plugin.id, metadata: plugin.metadata })),
      );
      const composedModules = Object.freeze(
        plugins.map((plugin) =>
          Object.freeze({
            id: plugin.id,
            app: plugin.id === this.appId,
            metadata: plugin.metadata,
            settings: plugin.settings,
            ui: plugin.ui,
          }),
        ),
      );
      const translation = Object.freeze({
        translate: this.translator(),
        text: (key: string | undefined, fallback: string, values?: MessageValues) =>
          this.text(key, fallback, values),
        subscribe: this.subscribeTranslations,
      });
      for (const plugin of plugins) {
        const scope = new PluginScope(this.actions, this.groups);
        assignScopeModule(
          scope,
          { id: plugin.id, app: plugin.id === this.appId },
          composed,
          composedModules,
          translation,
        );
        this.scopes.push(scope);
      }
      this.installContributions(plugins);
      plugins.forEach((plugin, index) => {
        for (const contribution of plugin.actions)
          this.install(this.scopes[index], contribution, plugin.id, moduleEvents.get(plugin.id)!);
      });
      this.observe(new Set([...this.container.observed, this.settings]));
      plugins.forEach((plugin, index) => {
        const scope = this.scopes[index];
        try {
          const cleanup = plugin.setup?.({ app: scope, services: this.services });
          if (cleanup) scope.own(cleanup);
        } catch (error) {
          throw this.attribute(error, plugin.id, 'Setup');
        }
      });
      this.syncIdentity();
    } catch (error) {
      this.unmount();
      throw error;
    }
    const controller = new AbortController();
    this.startController = controller;
    const pending = this.readyDeferred;
    const finish = () => {
      if (this.startController !== controller) return;
      this.setReady(true);
      pending.resolve();
    };
    if (!this.container.hasStartHooks) finish();
    else
      void this.container.start(controller.signal).then(finish, (error) => {
        if (this.startController !== controller) return;
        pending.reject(error);
      });
    return () => this.unmount();
  }
  /** Routes each contribution kind to the one module that installs it; cleanup stays with the contributor. */
  private installContributions(plugins: readonly NormalizedPlugin[]) {
    const installers = new Map<string, { module: string; install: ContributionInstaller<any> }>();
    for (const plugin of plugins)
      for (const [kind, install] of Object.entries(plugin.installs ?? {})) {
        if (!install) continue;
        const existing = installers.get(kind);
        if (existing)
          throw new FoundationStartupError(
            `Contribution kind "${kind}" is installed by both "${existing.module}" and "${plugin.id}".`,
            plugin.id,
          );
        installers.set(kind, { module: plugin.id, install });
      }
    for (const plugin of plugins)
      for (const [kind, values] of Object.entries(plugin.contributions ?? {}))
        if (values?.length && !installers.has(kind))
          throw new FoundationStartupError(
            `"${plugin.id}" contributes "${kind}", but no enabled plugin installs that kind.`,
            plugin.id,
            { app: plugin.id === this.appId },
          );
    for (const [kind, { install }] of installers)
      plugins.forEach((plugin, index) => {
        const values = plugin.contributions?.[kind];
        if (!values?.length) return;
        try {
          const cleanup = install(values, {
            module: plugin.id,
            app: plugin.id === this.appId,
            services: this.services,
          });
          if (cleanup) this.scopes[index].own(cleanup);
        } catch (error) {
          throw this.attribute(error, plugin.id, `Contribution "${kind}"`);
        }
      });
  }
  private connectTranslation() {
    const i18n = this.services.i18n;
    if (!i18n) return;
    this.setTranslations(i18n.translate);
    this.extensionCleanups.push(i18n.subscribe(() => this.setTranslations(i18n.translate)));
  }
  private installInterceptors(plugins: readonly NormalizedPlugin[]) {
    const entries = plugins
      .flatMap((plugin) => (plugin.interceptors ?? []).map((spec) => ({ spec, module: plugin.id })))
      .filter(({ spec }) => !isServiceInterceptor(spec))
      .sort((a, b) => (a.spec.order ?? 0) - (b.spec.order ?? 0));
    for (const { spec, module } of entries) {
      const definition = spec as ActionInterceptorSpec;
      const global =
        definition.scope === 'global' || (module === this.appId && definition.scope !== 'plugin');
      const requester = {
        label: `An interceptor in ${moduleLabel(module, this.appId)}`,
        source: contributionSource(spec),
      };
      try {
        this.requireServices(module, definition.requires, requester);
      } catch (error) {
        throw this.attribute(error, module, 'Interceptor', requester.source);
      }
      const applies = (id: string) =>
        matchesTarget(definition.action ?? '*', id) &&
        (global || this.actionConfigs.get(id)?.module === module);
      const context = <T extends { id: string }>(base: T) => ({
        ...base,
        services: this.services,
        config: this.actionConfigs.get(base.id)?.config ?? this.configuration.context(module),
        app: this.app,
        translate: this.translator(),
      });
      const report = (error: unknown) =>
        console.error(`[bitakit] Interceptor in ${moduleLabel(module, this.appId)} failed.`, error);
      if (definition.before)
        this.extensionCleanups.push(
          this.actions.use({
            before: (base) =>
              applies(base.id) ? definition.before!(context(base) as never) : undefined,
          }),
        );
      if (definition.after || definition.onError)
        this.extensionCleanups.push(
          this.actions.subscribeExecution((event) => {
            if (!applies(event.id)) return;
            try {
              if (event.phase === 'completed' && definition.after)
                void Promise.resolve(
                  definition.after({
                    ...context(event.context),
                    result: event.result?.status === 'completed' ? event.result.value : undefined,
                  } as never),
                ).catch(report);
              if (event.phase === 'failed' && definition.onError)
                void Promise.resolve(
                  definition.onError({
                    ...context(event.context),
                    error: isActionFailure(event.error) ? event.error.cause : event.error,
                  } as never),
                ).catch(report);
            } catch (error) {
              report(error);
            }
          }),
        );
    }
  }
  /** Resolves required names to container keys; a missing one is attributed to `module`. */
  private requireServices(
    module: string,
    ids: readonly string[] = [],
    requester: ServiceRequester,
  ): string[] {
    const instances = this.container!.services;
    const exists = (key: string) => Object.hasOwn(instances, key);
    return ids.map((id) => {
      const key = this.names.key(id);
      if (!exists(key)) throw this.names.missing(module, id, requester, exists);
      return key;
    });
  }
  private attribute(error: unknown, module: string, what: string, source?: string) {
    if (isFoundationStartupError(error)) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new FoundationStartupError(
      `${what} in ${moduleLabel(module, this.appId)} failed to start: ${message}${source ? `\nSource: ${source}` : ''}`,
      module,
      { cause: error, source, app: module === this.appId },
    );
  }
  /** One path for every action: adapt, check dependencies, register, remember for re-translation. */
  private install(
    scope: PluginScope,
    contribution: ResolvedContribution,
    module: string,
    events: Events,
  ) {
    const path = contributionPath(contribution) ?? contribution.id.split('.');
    const source = contributionSource(contribution);
    let adapted: ReturnType<typeof adaptAction>;
    try {
      const config = this.configuration.context(module, path);
      adapted = adaptAction(contribution, this, config, events);
      this.requireServices(module, adapted.requires, {
        label: `Action "${adapted.definition.id}"`,
        source,
      });
      for (const registration of adapted.registrations) {
        this.actionConfigs.set(registration.id, { module, config });
        const handle = this.actions.register(registration.definition, registration.placement);
        scope.own(handle.unregister);
        if (adapted.confirm) {
          const confirm = adapted.confirm;
          handle.onDispose(
            this.actions.use({
              before: (context) => (context.id === registration.id ? confirm(context) : undefined),
            }),
          );
        }
        this.registrations.push({ definition: adapted.definition, handle });
      }
    } catch (error) {
      throw this.attribute(error, module, `Action "${contribution.id}"`, source);
    }
  }
  /** Every store and observable service refreshes action presentation when it changes. */
  private observe(observed: ReadonlySet<Observable>) {
    for (const source of observed)
      this.extensionCleanups.push(
        source.subscribe(() => {
          if (!this.container) return;
          this.actions.refresh();
          this.syncIdentity();
        }),
      );
    if (observed.size) this.actions.refresh();
  }
  private unmount() {
    const starting = this.startController !== undefined && !this.mounted;
    this.startController?.abort();
    this.startController = undefined;
    this.setReady(false);
    this.settings.deactivate();
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
    this.events.clear();
    for (const module of this.modules)
      if (module.events) this.events.declare(module.id, module.events);
    this.container = undefined;
    this.view = undefined;
    this.registrations = [];
    this.actionConfigs.clear();
    if (starting)
      this.readyDeferred.reject(
        new Error('The runtime stopped before its services finished starting.'),
      );
    this.readyDeferred = deferred();
    this.publish(null);
    if (errors.length) throw new AggregateError(errors, 'Foundation cleanup failed.');
  }
}

function defaultFailure(error: unknown) {
  let development = true;
  try {
    development = process.env.NODE_ENV !== 'production';
  } catch {
    /* no process */
  }
  if (!development) return 'Something went wrong.';
  return error instanceof Error && error.message ? error.message : 'Action failed.';
}

/**
 * Creates the runtime for one composition; `runtime.mount()` starts it and returns the stop
 * function. Core creates the ActionList unless you pass one. `services` supplies host-owned
 * services, such as authentication, under their contract names.
 */
export function createRuntime(
  config: FoundationConfig,
  options: { actions?: ActionList; services?: Readonly<Record<string, unknown>> } = {},
): FoundationRuntime {
  return new FoundationRuntime(options.actions ?? createActionList(), config, options.services);
}
