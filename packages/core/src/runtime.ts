import type { RuntimeActionPlacement } from './slots/action-placement.js';
import { EventService, createEventScope } from './events/service.js';
import { normalizeSlots, validateSlotDeclarations } from './slots/normalize.js';
import type { OwnedSlotDefinition } from './slots/define.js';
import { SlotRuntime } from './slots/runtime.js';
import type { SlotReader } from './slots/types.js';
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
import { PluginScope, assignScopeModule, scopeModule, readsComposition } from './scope.js';
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
import { cleanupSequence, cleanupFailure, type Cleanup } from './lifecycle/cleanup.js';
import {
  createLifecycleState,
  type LifecycleState,
  type LifecyclePhase,
} from './lifecycle/state.js';
import {
  updateClosure,
  updateRestrictions,
  type PluginUpdateResult,
  type PluginDependentOptions,
} from './lifecycle/reconcile.js';
export type { DialogState } from './contributions/index.js';

/** A plugin after normalization: records resolved to arrays with IDs, `ui` merged with the legacy fields. */
export type NormalizedPlugin = Omit<Plugin, 'services' | 'actions' | 'slots'> & {
  readonly id: string;
  readonly services: readonly (ServiceDefinition<any> & { id: string })[];
  readonly actions: readonly ResolvedContribution[];
  readonly slots: readonly OwnedSlotDefinition[];
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
          ([key, service]) =>
            preserveContributionPath(service, {
              ...service,
              id: service.id ?? (isApp ? key : `${id}.${key}`),
            }) as ServiceDefinition<any> & { id: string },
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
      slots: normalizeSlots(module, appId),
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
  private currentModules: readonly NormalizedPlugin[];
  get modules(): readonly NormalizedPlugin[] {
    return this.currentModules;
  }
  private currentConfig: FoundationConfig;
  get config(): FoundationConfig {
    return this.currentConfig;
  }
  readonly groups: Map<string, ActionGroup>;
  /** The owner of setting values; `useSetting` and the `settings` contexts read from it. */
  readonly settings: SettingsStore;
  /** Typed handles under plugin namespaces, the `settings` every context receives. */
  readonly settingsAccess: SettingsAccess;
  private defaultStorage?: SettingsStorage;
  private readonly appId: string;
  private order: readonly NormalizedPlugin[];
  private readonly names: ServiceNames;
  private readonly actionConfigs = new Map<string, { module: string; config: ConfigContext }>();
  private mounted = false;
  private mounting = false;
  private tearingDown = false;
  readonly lifecycle: LifecycleState;
  readonly slots: SlotReader;
  private slotRuntime: SlotRuntime;
  private lifecycleState: ReturnType<typeof createLifecycleState>;
  private generation = 0;
  private stopCompletion?: Deferred;
  private mountStop?: () => Promise<void>;
  private startWork?: Promise<void>;
  private startPending = false;
  private setupComplete = false;
  private activeRuns = new Map<
    object,
    { promise: Promise<void>; resolve(): void; plugin?: string }
  >();
  private updating?: Promise<PluginUpdateResult>;
  private updateController?: AbortController;
  private disabledPlugins = new Set<string>();
  /** Host-only structural changes; no package loading or persistence is performed by Core. */
  readonly plugins = Object.freeze({
    add: (plugins: readonly Plugin[]) => this.changePlugins('add', [...plugins]),
    remove: (ids: readonly string[], options: PluginDependentOptions) =>
      this.changePlugins('remove', [...ids], options),
    enable: (id: string) => this.changePlugins('enable', [id]),
    disable: (id: string, options: PluginDependentOptions) =>
      this.changePlugins('disable', [id], options),
  });
  private revision = 0;
  getRevision = () => this.revision;
  private observations = new Map<Observable, () => void>();
  private pluginEvents = new Map<string, ReturnType<typeof createEventScope>>();
  /** Settles after the current shutdown; a rejection means cleanup did not complete successfully. */
  get stopped(): Promise<void> {
    return this.stopCompletion?.promise ?? Promise.resolve();
  }
  stop = (): Promise<void> => this.mountStop?.() ?? Promise.resolve();
  private readinessListeners = new Set<() => void>();
  private readyDeferred = deferred();
  private startController?: AbortController;
  /** Initial startup has completed and shutdown has not begun. Updates use owner readiness. */
  isReady = (plugin?: string) =>
    this.mounted &&
    (plugin === undefined ||
      this.lifecycle.get().plugins.some((entry) => entry.id === plugin && entry.phase === 'ready'));
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
    for (const listener of this.readinessListeners) {
      try {
        listener();
      } catch (error) {
        this.reportLifecycleError(error);
      }
    }
    // Presentation may read app.ready.
    if (this.container) {
      try {
        this.actions.refresh();
      } catch (error) {
        this.reportLifecycleError(error);
      }
    }
  }
  private listeners = new Set<() => void>();
  private state: DialogState | null = null;
  private registrations: { definition: ResolvedContribution; handle: ActionRegistration }[] = [];
  private scopes: PluginScope[] = [];
  private extensionCleanups: Cleanup[] = [];
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
    config: FoundationConfig,
    private providedServices: Readonly<Record<string, unknown>> = {},
  ) {
    this.currentConfig = config;
    this.appId = config.appId ?? 'app';
    const { plugins = [], appId: _appId, ...appModule } = config;
    this.currentModules = [
      normalize({ ...appModule, id: this.appId } as Plugin, this.appId),
      ...plugins.map((plugin) => normalize(plugin, this.appId)),
    ];
    this.order = orderPlugins(this.modules, this.appId);
    validateSlotDeclarations(this.modules, this.appId);
    this.events = new EventService(config.onEventError);
    const publishLifecycle = this.events.reserve('runtime');
    this.lifecycleState = createLifecycleState(
      this.modules.map((module) => module.id),
      this.serviceEntries().filter((entry) => !Object.hasOwn(this.providedServices, entry.id)),
      (snapshot) => publishLifecycle('runtime.lifecycle', snapshot),
      (error) => this.reportLifecycleError(error),
    );
    this.lifecycle = this.lifecycleState.state;
    this.slotRuntime = new SlotRuntime(
      this.modules.flatMap((module) => module.slots),
      this.lifecycle,
      this.actions,
      (snapshot) => publishLifecycle('runtime.slot', snapshot),
      (error) => this.reportLifecycleError(error),
      this.appId,
    );
    this.slots = this.slotRuntime.reader;
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

  private serviceEntries(modules: readonly NormalizedPlugin[] = this.modules): ServiceEntry[] {
    const entries: ServiceEntry[] = Object.keys(this.providedServices).map((id) => ({
      id,
      aliases: [],
      plugin: this.appId,
    }));
    for (const module of modules) {
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
  private settingEntries(modules: readonly NormalizedPlugin[] = this.modules): SettingEntry[] {
    const entries: SettingEntry[] = [];
    for (const module of modules)
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
  actionOwner(id: string): string | undefined {
    const registered = this.actionConfigs.get(id)?.module;
    if (registered) return registered;
    const scope = this.scopes.find((scope) => scope.ownsAction(id));
    return scope ? scopeModule(scope).id : undefined;
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
  /** UI availability; raw service access remains available to dependent cleanup hooks. */
  isServiceReady(name: string): boolean {
    if (!this.isReady() || !this.hasService(name)) return false;
    const id = this.names.key(name);
    if (Object.hasOwn(this.providedServices, id)) return true;
    const entry = this.lifecycle.get().services.find((service) => service.id === id);
    return entry?.phase === 'ready' && this.isReady(entry.plugin);
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
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.reportLifecycleError(error);
      }
    }
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

  private reportLifecycleError(error: unknown) {
    try {
      console.error('[bitakit] Lifecycle failed.', error);
    } catch {
      /* reporting only */
    }
  }
  private servicePhase(id: string, phase: LifecyclePhase, error?: unknown) {
    const failure =
      error === undefined
        ? undefined
        : { message: error instanceof Error ? error.message : String(error) };
    this.lifecycleState.service(id, phase, failure);
    const owner = this.lifecycle.get().services.find((entry) => entry.id === id)?.plugin;
    if (owner && phase === 'failed') this.lifecycleState.plugin(owner, 'failed', failure);
    if (this.setupComplete && phase === 'ready') this.refreshPluginReadiness();
  }
  private refreshPluginReadiness() {
    // Ready means the owner's initialization and declared dependencies are ready.
    // Iterate to cover implicit service edges that are not explicit plugin ordering edges.
    for (let changed = true; changed && !this.stopCompletion; ) {
      changed = false;
      for (const plugin of this.order) {
        const state = this.lifecycle.get();
        if (state.plugins.find((entry) => entry.id === plugin.id)?.phase !== 'starting') continue;
        const required = [
          ...plugin.services,
          ...plugin.actions,
          ...(plugin.interceptors ?? []),
        ].flatMap((definition) => definition.requires ?? []);
        const ownReady = state.services
          .filter((entry) => entry.plugin === plugin.id)
          .every((entry) => entry.phase === 'ready');
        const dependenciesReady = (plugin.dependencies ?? []).every(
          (id) => state.plugins.find((entry) => entry.id === id)?.phase === 'ready',
        );
        const servicesReady = required.every((name) => {
          const id = this.names.key(name);
          return (
            Object.hasOwn(this.providedServices, id) ||
            state.services.find((entry) => entry.id === id)?.phase === 'ready'
          );
        });
        if (ownReady && dependenciesReady && servicesReady) {
          changed = true;
          this.lifecycleState.plugin(plugin.id, 'ready');
        }
      }
    }
  }
  mount(): () => Promise<void> {
    if (this.mounting || this.tearingDown || this.lifecycle.get().cleanup === 'failed')
      throw new Error(
        'Foundation cannot mount during a lifecycle transition or after failed cleanup.',
      );
    this.mounting = true;
    try {
      return this.start();
    } finally {
      this.mounting = false;
    }
  }
  private start() {
    if (this.container || this.lifecycle.get().phase === 'stopping')
      throw new Error(
        'Foundation is already mounted or still stopping. Await its stop before mounting.',
      );
    this.stopCompletion = undefined;
    if (this.generation) this.readyDeferred = deferred();
    const generation = ++this.generation;
    let completion: Promise<void> | undefined;
    this.mountStop = () =>
      (completion ??= generation === this.generation ? this.unmount() : Promise.resolve());
    const stop = this.mountStop;
    this.setupComplete = false;
    this.lifecycleState.update({
      generation,
      operation: Object.freeze({ kind: 'start', startedAt: Date.now() }),
      phase: 'starting',
      cleanup: 'none',
      plugins: Object.freeze(
        this.lifecycle
          .get()
          .plugins.map((entry) =>
            Object.freeze({ ...entry, phase: 'starting' as const, failure: undefined }),
          ),
      ),
      services: Object.freeze(
        this.lifecycle
          .get()
          .services.map((entry) =>
            Object.freeze({ ...entry, phase: 'idle' as const, failure: undefined }),
          ),
      ),
    });
    const plugins = this.order;
    const owners = new Map<ServiceDefinition<any>, string>();
    for (const plugin of plugins)
      for (const service of plugin.services) owners.set(service, plugin.id);
    const interceptors: InterceptorSpec[] = plugins.flatMap((plugin) => plugin.interceptors ?? []);
    this.container = createServices(
      plugins.flatMap((plugin) => plugin.services),
      this.providedServices,
      (definition) =>
        this.configuration.context(
          owners.get(definition) ??
            this.modules.find((module) => module.services.includes(definition as never))?.id ??
            this.appId,
        ),
      serviceObserver(interceptors, (id) => this.aliasesOf(id)),
      this.events,
      {
        names: this.names,
        appId: this.appId,
        moduleOf: (definition) =>
          owners.get(definition) ??
          this.modules.find((module) => module.services.includes(definition as never))?.id ??
          this.appId,
        sourceOf: (definition) => contributionSource(definition),
      },
      (definition) => definition.id!,
      this.settingsAccess,
      (id, phase, error) => this.servicePhase(id, phase, error),
    );
    // Contexts exist only after the container does; readiness is the public facade's concern.
    this.view = this.names.tree(this.container.services);
    const moduleEvents = new Map<string, Events>();
    try {
      this.container.initialize();
      this.extensionCleanups.push(
        this.actions.subscribeExecution((event) => {
          if (
            event.phase === 'started' &&
            (this.registrations.some((entry) => entry.definition.id === event.id) ||
              this.scopes.some((scope) => scope.ownsAction(event.id)))
          ) {
            const pending = deferred();
            this.activeRuns.set(event.context, {
              ...pending,
              plugin:
                this.actionConfigs.get(event.id)?.module ??
                (this.scopes.find((scope) => scope.ownsAction(event.id))
                  ? scopeModule(this.scopes.find((scope) => scope.ownsAction(event.id))!).id
                  : undefined),
            });
          } else if (event.phase !== 'started') {
            this.activeRuns.get(event.context)?.resolve();
            this.activeRuns.delete(event.context);
          }
        }),
        this.actions.use({
          before: ({ id }) => {
            const phase = this.lifecycle.get().phase;
            const scope = this.scopes.find((entry) => entry.ownsAction(id));
            const owner = this.actionConfigs.get(id)?.module ?? (scope && scopeModule(scope).id);
            if (
              owner &&
              (this.stopCompletion ||
                phase === 'stopping' ||
                phase === 'stopped' ||
                (phase === 'failed' && !this.isReady()) ||
                (this.isReady() && !this.isReady(owner)))
            )
              return false;
          },
        }),
        this.actions.subscribeExecution((event) => {
          if (event.phase === 'failed' && event.context.get() && isActionFailure(event.error))
            this.notify(event.error.feedback, 'failure');
        }),
      );
      for (const plugin of plugins) {
        const scope = createEventScope(this.events, plugin.id);
        this.pluginEvents.set(plugin.id, scope);
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
          this.lifecycle,
        );
        this.scopes.push(scope);
        scope.bindSlots(this.slotRuntime.bind(scope, plugin.id));
        scope.onClose(this.pluginEvents.get(plugin.id)!.dispose);
      }
      this.installContributions(plugins);
      plugins.forEach((plugin, index) => {
        for (const contribution of plugin.actions)
          this.install(this.scopes[index], contribution, plugin.id, moduleEvents.get(plugin.id)!);
      });
      // Declared targets and programmatic contributions share the same owned attachment path.
      // Undeclared UI slots retain their existing rendering until the placement migration.
      plugins.forEach((plugin, index) => {
        for (const [viewIndex, view] of plugin.views.entries()) {
          if (!this.slots.has(view.slot)) continue;
          const contribution = {
            id: view.id ?? `view:${viewIndex}`,
            component: view.component,
            key: view.key,
            order: view.order,
            when: view.when,
          };
          preserveContributionPath(view, contribution);
          try {
            this.scopes[index].slots.attach(view.slot, contribution, {
              availability: view.availability ?? 'wait',
            });
          } catch (error) {
            throw this.attribute(error, plugin.id, `Slot "${view.slot}"`, contributionSource(view));
          }
        }
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
      this.setupComplete = true;
      this.refreshPluginReadiness();
    } catch (error) {
      this.startFailed(error);
      void stop();
      throw error;
    }
    if (this.stopCompletion) return stop;
    const controller = new AbortController();
    this.startController = controller;
    const pending = this.readyDeferred;
    const finish = () => {
      if (this.startController !== controller || this.stopCompletion) return;
      this.startPending = false;
      for (const plugin of plugins) this.lifecycleState.plugin(plugin.id, 'ready');
      if (this.stopCompletion) return;
      this.lifecycleState.update({ phase: 'ready' });
      if (this.stopCompletion) return;
      this.setReady(true);
      if (!this.stopCompletion) pending.resolve();
    };
    if (!this.container.hasStartHooks) {
      for (const entry of this.lifecycle.get().services) this.servicePhase(entry.id, 'ready');
      finish();
    } else {
      this.startPending = true;
      this.startWork = this.container.start(controller.signal);
      void this.startWork.then(finish, (error) => {
        this.startPending = false;
        if (this.startController !== controller || this.stopCompletion) return;
        this.startFailed(error);
        pending.reject(error);
      });
    }
    return stop;
  }
  private startFailed(error: unknown) {
    const failure = {
      message: error instanceof Error ? error.message : String(error),
      ...(isFoundationStartupError(error) ? { plugin: error.plugin, source: error.source } : {}),
    };
    if (isFoundationStartupError(error))
      this.lifecycleState.plugin(error.plugin, 'failed', failure);
    this.lifecycleState.update({ phase: 'failed' });
    this.readyDeferred.reject(error);
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
    const i18n = this.hasService('i18n') ? this.services.i18n : undefined;
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
      adapted = adaptAction(contribution, this, config, events, () => this.isReady(module));
      this.requireServices(module, adapted.requires, {
        label: `Action "${adapted.definition.id}"`,
        source,
      });
      for (const registration of adapted.registrations) {
        this.actionConfigs.set(registration.id, { module, config });
        const handle = this.actions.register(registration.definition, registration.placement);
        scope.own(handle.unregister);
        // Placement is a reference to this registration, not another Action or execution path.
        if (!registration.definition.internal) {
          for (const placement of (adapted.definition.slots ??
            []) as readonly RuntimeActionPlacement[]) {
            const target = typeof placement === 'string' ? { name: placement } : placement;
            const reference = {
              id: `action:${registration.id}:${target.key ?? ''}`,
              actionId: registration.id,
              input: target.input,
              key: target.key,
              order: target.order ?? contribution.order,
            };
            preserveContributionPath(contribution, reference);
            const attached = scope.slots.attach(target.name, reference, {
              availability: target.availability ?? 'wait',
            });
            handle.onDispose(attached.dispose);
          }
        }
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
  /** Reconcile subscriptions over the existing container; never mirror service state. */
  private observe(observed: ReadonlySet<Observable>, refresh = true) {
    for (const [source, off] of this.observations)
      if (!observed.has(source)) {
        off();
        this.observations.delete(source);
      }
    for (const source of observed)
      if (!this.observations.has(source))
        this.observations.set(
          source,
          source.subscribe(() => {
            if (!this.container) return;
            this.actions.refresh();
            this.syncIdentity();
          }),
        );
    if (refresh && observed.size) this.actions.refresh();
  }

  /** Plan structural changes before touching scopes; use the existing update exclusion and executor. */
  private changePlugins(
    operation: 'add' | 'remove' | 'enable' | 'disable',
    values: readonly Plugin[] | readonly string[],
    options?: PluginDependentOptions,
  ): Promise<PluginUpdateResult> {
    const result = (
      status: PluginUpdateResult['status'],
      reasons: string[],
      changed: string[] = [],
    ): Promise<PluginUpdateResult> =>
      Promise.resolve(
        Object.freeze({
          status,
          reasons: Object.freeze(reasons),
          changed: Object.freeze(changed),
          affected: Object.freeze([]),
          revision: this.revision,
        }),
      );
    if (
      this.updating ||
      this.mounting ||
      this.tearingDown ||
      this.stopCompletion ||
      !this.container ||
      this.startPending
    )
      return result('blocked', ['A lifecycle operation is active or the runtime is not mounted.']);
    if (this.lifecycle.get().cleanup === 'failed')
      return result('blocked', ['Failed cleanup requires resource recovery and a new runtime.']);
    try {
      const installed = [...(this.config.plugins ?? [])];
      const disabled = new Set(this.disabledPlugins);
      const ids =
        operation === 'add'
          ? (values as Plugin[]).map((plugin) => plugin.id)
          : (values as string[]);
      if (new Set(ids).size !== ids.length)
        return result('blocked', ['Plugin IDs must be unique.']);
      if (ids.includes(this.appId))
        return result('blocked', ['The app module cannot be changed through plugins.']);
      if (
        (operation === 'remove' || operation === 'disable') &&
        !['stop', 'refuse'].includes(options?.dependents ?? '')
      )
        return result('blocked', ['Choose dependents: stop or refuse.']);
      for (const id of ids) {
        const exists = installed.some((plugin) => plugin.id === id);
        if (operation === 'add' ? exists : !exists)
          return result('blocked', [
            `Plugin "${id}" ${exists ? 'is already installed' : 'is not installed'}.`,
          ]);
      }
      const activeIds = new Set(this.modules.map((module) => module.id));
      let changed = [...ids];
      if (operation === 'disable' || operation === 'remove') {
        const seeds = ids.filter((id) => activeIds.has(id));
        if (operation === 'remove') seeds.push(...this.slotRuntime.contributorsTo(new Set(ids)));
        const closure = updateClosure(this.modules, seeds);
        const dependents = closure.filter((id) => !ids.includes(id));
        if (dependents.length && options?.dependents === 'refuse')
          return result('blocked', [`Enabled dependents: ${dependents.join(', ')}.`]);
        changed = [...new Set([...ids, ...dependents])];
        for (const id of changed) disabled.add(id);
      } else if (operation === 'enable') {
        changed = ids.filter((id) => disabled.has(id) || !this.isReady(id));
        for (const id of ids) disabled.delete(id);
      } else installed.push(...(values as Plugin[]));
      const nextInstalled =
        operation === 'remove' ? installed.filter((plugin) => !ids.includes(plugin.id)) : installed;
      for (const id of ids) if (operation === 'remove') disabled.delete(id);
      if (operation === 'disable') changed = changed.filter((id) => !this.disabledPlugins.has(id));
      if (!changed.length) return result('applied', []);
      const normalized = nextInstalled
        .filter((plugin) => !disabled.has(plugin.id))
        .map((plugin) => normalize(plugin, this.appId));
      const app = this.modules.find((module) => module.id === this.appId)!;
      const all = [app, ...normalized];
      const declarations = [app, ...nextInstalled.map((plugin) => normalize(plugin, this.appId))];
      orderPlugins(all, this.appId);
      validateSlotDeclarations(declarations, this.appId);
      validatePluginPages(all, new Set(Object.keys(app.ui?.layouts ?? {})));
      // Failed updates may have already disposed a projection's scope. Recover its recorded
      // failure cohort when the host retries one of those owners, without restarting other failures.
      const lifecycle = this.lifecycle.get();
      const failures = new Set(
        changed.flatMap((id) => {
          const owner = lifecycle.plugins.find((entry) => entry.id === id);
          return owner?.failure?.plugin ? [owner.failure.plugin] : [];
        }),
      );
      const readers = [
        ...new Set([
          ...this.scopes.filter(readsComposition).map((scope) => scopeModule(scope).id),
          ...lifecycle.plugins
            .filter(
              (entry) =>
                entry.failure?.plugin &&
                failures.has(entry.failure.plugin) &&
                activeIds.has(entry.id) &&
                !disabled.has(entry.id),
            )
            .map((entry) => entry.id),
        ]),
      ];
      const before = updateClosure(this.modules, [
        ...changed.filter((id) => activeIds.has(id)),
        ...readers,
      ]);
      const after = updateClosure(
        all,
        [...changed, ...readers].filter((id) => all.some((module) => module.id === id)),
      );
      const affected = [...new Set([...before, ...after])];
      const reasons: string[] = [];
      for (const module of [...this.modules, ...all].filter((module) =>
        affected.includes(module.id),
      )) {
        if (
          module.id === this.appId ||
          module.providers.length ||
          Object.keys(module.ui?.layouts ?? {}).length ||
          module.interceptors?.length ||
          Object.keys(module.installs ?? {}).length ||
          Object.keys(module.contributions ?? {}).length
        )
          reasons.push(
            `${module.id}: host, provider or cross-plugin installer/interceptor requires composition replacement.`,
          );
        if (
          module.services.some((service) =>
            [service.id, service.provides, service.exposeAs].some((name) =>
              ['auth', 'i18n', 'settings.storage'].includes(name as string),
            ),
          )
        )
          reasons.push(
            `${module.id}: host identity, translation or storage service requires composition replacement.`,
          );
      }
      if (reasons.length) return result('restart-required', [...new Set(reasons)], changed);
      const entries = this.serviceEntries(all);
      const names = new ServiceNames(entries, this.appId);
      for (const module of all)
        for (const definition of [
          ...module.services,
          ...module.actions,
          ...(module.interceptors ?? []),
        ])
          for (const requirement of definition.requires ?? [])
            if (!names.known(requirement))
              throw new Error(`${module.id}: missing required service "${requirement}".`);
      updateClosure(
        all,
        all.map((module) => module.id),
      );
      const actionIds = all.flatMap((module) => module.actions.map((action) => action.id));
      if (new Set(actionIds).size !== actionIds.length)
        throw new Error('Duplicate Action ID in proposed composition.');
      const settings = this.settingEntries(declarations);
      for (const entry of this.settings.entries())
        if (
          !settings.some((next) => next.key === entry.key) &&
          this.settings.state(entry.key).pending
        )
          return result('blocked', [`Setting "${entry.key}" has a pending write.`]);
      createSettingsAccess(new SettingsStore(settings, () => this.storage()));
      const overrides = Object.fromEntries(
        Object.entries(this.config.configOverrides ?? {}).filter(([id]) =>
          declarations.some((module) => module.id === id),
        ),
      );
      const configuration = new ConfigService(declarations, overrides);
      const eventCheck = new EventService();
      eventCheck.reserve('runtime');
      for (const module of declarations)
        if (module.events) eventCheck.declare(module.id, module.events);
      const controller = new AbortController();
      this.updateController = controller;
      this.updating = Promise.resolve().then(() =>
        this.applyPluginUpdate(
          nextInstalled,
          normalized,
          changed,
          affected,
          controller,
          () => {
            // Writes may begin while awaited Action/scope cleanup is in progress.
            for (const entry of this.settings.entries())
              if (
                !settings.some((next) => next.key === entry.key) &&
                this.settings.state(entry.key).pending
              )
                return `Setting "${entry.key}" began writing during cleanup; await it before retrying.`;
            this.disabledPlugins = disabled;
            this.names.replace(entries);
            this.configuration.replace(configuration);
            for (const plugin of this.config.plugins ?? []) this.events.undeclare(plugin.id);
            this.events.undeclare(this.appId);
            for (const module of declarations)
              if (module.events) this.events.declare(module.id, module.events);
            this.slotRuntime.replace(declarations.flatMap((module) => module.slots));
            this.settings.replace(settings);
          },
          before,
          after,
        ),
      );
      void this.updating
        .finally(() => {
          this.updating = undefined;
          this.updateController = undefined;
        })
        .catch(() => {});
      return this.updating;
    } catch (error) {
      return result('blocked', [error instanceof Error ? error.message : String(error)]);
    }
  }

  /** Explicit host update of already-loaded immutable plugin definitions; never installs code. */
  reconcilePlugins(next: readonly Plugin[]): Promise<PluginUpdateResult> {
    next = [...next];
    const result = (
      status: PluginUpdateResult['status'],
      reasons: string[],
      changed: string[] = [],
      affected: string[] = [],
    ): PluginUpdateResult =>
      Object.freeze({
        status,
        revision: this.revision,
        reasons: Object.freeze(reasons),
        changed: Object.freeze(changed),
        affected: Object.freeze(affected),
      });
    if (
      this.updating ||
      this.mounting ||
      this.tearingDown ||
      this.stopCompletion ||
      !this.container ||
      this.startPending
    )
      return Promise.resolve(
        result('blocked', ['A lifecycle operation is active or the runtime is not mounted.']),
      );
    if (this.lifecycle.get().cleanup === 'failed')
      return Promise.resolve(
        result('blocked', ['Failed cleanup requires resource recovery and a new runtime.']),
      );
    const current = this.config.plugins ?? [];
    if (this.disabledPlugins.size)
      return Promise.resolve(
        result('restart-required', ['Enable installed plugins before compatible updates.']),
      );
    if (
      JSON.stringify(current.map((plugin) => plugin.id)) !==
      JSON.stringify(next.map((plugin) => plugin.id))
    )
      return Promise.resolve(
        result('restart-required', [
          'Changing plugin membership or order requires composition replacement.',
        ]),
      );
    let normalized: NormalizedPlugin[];
    let affected: string[];
    const failed = this.lifecycle
      .get()
      .plugins.filter((plugin) => plugin.phase === 'failed' || plugin.phase === 'blocked')
      .map((plugin) => plugin.id);
    const changed = next
      .filter((plugin, index) => plugin !== current[index] || failed.includes(plugin.id))
      .map((plugin) => plugin.id);
    if (!changed.length) return Promise.resolve(result('applied', []));
    try {
      normalized = next.map((plugin) => normalize(plugin, this.appId));
      const all = [this.modules.find((plugin) => plugin.id === this.appId)!, ...normalized];
      orderPlugins(all, this.appId);
      validateSlotDeclarations(all, this.appId);
      validatePluginPages(all, new Set(Object.keys(all[0].ui?.layouts ?? {})));
      // A projection that captured the composition is an explicit consumer of every revision.
      affected = updateClosure(all, [
        ...changed,
        ...this.scopes.filter(readsComposition).map((scope) => scopeModule(scope).id),
      ]);
      const reasons = next.flatMap((plugin, index) =>
        updateRestrictions(
          current[index],
          plugin,
          this.modules.find((module) => module.id === plugin.id)!,
          normalized[index],
        ),
      );
      for (const id of affected) {
        const module = all.find((module) => module.id === id)!;
        if (
          id === this.appId ||
          module.interceptors?.length ||
          Object.keys(module.installs ?? {}).length ||
          Object.keys(module.contributions ?? {}).length ||
          module.providers.length
        )
          reasons.push(
            `${id}: host, provider or cross-plugin installer/interceptor requires composition replacement.`,
          );
        if (
          module.services.some((service) =>
            [service.id, service.provides, service.exposeAs].some((name) =>
              ['auth', 'i18n', 'settings.storage'].includes(name as string),
            ),
          )
        )
          reasons.push(
            `${id}: replacing a host identity, translation or storage service requires composition replacement.`,
          );
      }
      if (reasons.length)
        return Promise.resolve(result('restart-required', reasons, changed, affected));
    } catch (error) {
      return Promise.resolve(
        result('blocked', [error instanceof Error ? error.message : String(error)], changed),
      );
    }
    const controller = new AbortController();
    this.updateController = controller;
    // Establish exclusion before any synchronous status observer or cleanup callback runs.
    this.updating = Promise.resolve().then(() =>
      this.applyPluginUpdate(next, normalized, changed, affected, controller),
    );
    void this.updating
      .finally(() => {
        this.updating = undefined;
        this.updateController = undefined;
      })
      .catch(() => {});
    return this.updating;
  }

  private async stopPlugins(ids: readonly string[]) {
    const selected = new Set(ids);
    const scopes = this.scopes.filter((scope) => selected.has(scopeModule(scope).id));
    const registrations = this.registrations.filter((entry) =>
      selected.has(this.actionConfigs.get(entry.definition.id)?.module ?? ''),
    );
    const runs = [...this.activeRuns.values()].filter(
      (run) => run.plugin && selected.has(run.plugin),
    );
    const early: unknown[] = [];
    for (const id of ids) this.lifecycleState.plugin(id, 'stopping');
    if (
      this.state &&
      (selected.has(this.actionConfigs.get(this.state.definition.id)?.module ?? '') ||
        scopes.some((scope) => scope.ownsAction(this.state!.definition.id)))
    )
      this.close();
    for (const { handle } of registrations)
      try {
        handle.unregister();
      } catch (error) {
        early.push(error);
      }
    for (const scope of scopes)
      try {
        scope.close();
      } catch (error) {
        early.push(error);
      }
    this.registrations = this.registrations.filter((entry) => !registrations.includes(entry));
    for (const entry of registrations) this.actionConfigs.delete(entry.definition.id);
    this.scopes = this.scopes.filter((scope) => !scopes.includes(scope));
    const tasks: Cleanup[] = [() => Promise.all(runs.map((run) => run.promise)).then(() => {})];
    // Dependent scope cleanup can still use its provider's service until the next step.
    for (const id of [...ids].reverse())
      tasks.push(async () => {
        const own = scopes.find((scope) => scopeModule(scope).id === id);
        await cleanupSequence(
          [
            ...(own ? [() => own.dispose()] : []),
            () => this.container!.disposeModules(new Set([id])),
          ],
          (errors) => {
            this.lifecycleState.plugin(
              id,
              errors.length ? 'failed' : 'stopped',
              errors.length ? { plugin: id, message: 'Plugin cleanup failed.' } : undefined,
            );
            cleanupFailure(errors, `Plugin "${id}" cleanup failed.`);
          },
        );
        this.pluginEvents.delete(id);
      });
    await cleanupSequence(tasks, (errors) =>
      cleanupFailure([...early, ...errors], 'Plugin update cleanup failed.'),
    );
    this.observe(new Set([...this.container!.observed, this.settings]), false);
  }

  private async applyPluginUpdate(
    next: readonly Plugin[],
    normalized: NormalizedPlugin[],
    changed: string[],
    affected: string[],
    controller: AbortController,
    commit?: () => string | void,
    stopIds: readonly string[] = affected,
    startIds: readonly string[] = affected,
  ): Promise<PluginUpdateResult> {
    const result = (
      status: PluginUpdateResult['status'],
      reasons: string[] = [],
    ): PluginUpdateResult =>
      Object.freeze({
        status,
        revision: this.revision,
        changed: Object.freeze(changed),
        affected: Object.freeze(affected),
        reasons: Object.freeze(reasons),
      });
    // Initial readiness remains true: only the affected owners become unavailable.
    this.setupComplete = false;
    this.lifecycleState.update({
      operation: Object.freeze({ kind: 'update', startedAt: Date.now() }),
      phase: 'starting',
      plugins: Object.freeze(
        this.lifecycle
          .get()
          .plugins.map((entry) =>
            affected.includes(entry.id)
              ? Object.freeze({ ...entry, phase: 'stopping' as const })
              : entry,
          ),
      ),
    });
    try {
      await this.stopPlugins(stopIds);
    } catch (error) {
      this.lifecycleState.update({ phase: 'failed', cleanup: 'failed' });
      return result('failed', [error instanceof Error ? error.message : String(error)]);
    }
    if (controller.signal.aborted)
      return result('blocked', ['Update cancelled by runtime shutdown.']);
    try {
      const blocked = commit?.();
      if (blocked) {
        // Affected owners are already stopped; retain declarations and report that actual state.
        for (const id of stopIds)
          this.lifecycleState.plugin(id, 'blocked', {
            plugin: changed[0],
            message: 'Plugin change blocked after cleanup.',
          });
        this.lifecycleState.update({ phase: 'failed', cleanup: 'complete' });
        return result('blocked', [blocked]);
      }
      this.currentConfig = { ...this.config, plugins: [...next] };
      this.currentModules = [
        this.modules.find((module) => module.id === this.appId)!,
        ...normalized,
      ];
      this.order = orderPlugins(this.modules, this.appId);
      this.revision++;
      if (commit) {
        const previous = this.lifecycle.get();
        const entries = (
          values: readonly { id: string; plugin: string }[],
          existing: typeof previous.plugins,
        ) =>
          Object.freeze(
            values.map(({ id, plugin }) => {
              const before = existing.find((entry) => entry.id === id);
              const enabled = !this.disabledPlugins.has(plugin);
              return Object.freeze({
                ...before,
                id,
                plugin,
                enabled,
                phase: enabled ? (before?.phase ?? 'idle') : 'stopped',
                since: before?.since ?? Date.now(),
              } as const);
            }),
          );
        this.lifecycleState.update({
          plugins: entries(
            [
              { id: this.appId, plugin: this.appId },
              ...next.map((plugin) => ({ id: plugin.id, plugin: plugin.id })),
            ],
            previous.plugins,
          ),
          services: entries(this.serviceEntries(), previous.services),
        });
      }
    } catch (error) {
      // A declaration commit cannot be rolled back safely after observers have run.
      this.lifecycleState.update({ phase: 'failed', cleanup: 'failed' });
      return result('failed', [error instanceof Error ? error.message : String(error)]);
    }
    const plugins = startIds.map((id) => this.modules.find((module) => module.id === id)!);
    const selected = new Set(startIds);
    try {
      for (const id of startIds) this.lifecycleState.plugin(id, 'starting');
      this.container!.install(plugins.flatMap((plugin) => plugin.services));
      for (const plugin of plugins) {
        const events = createEventScope(this.events, plugin.id);
        this.pluginEvents.set(plugin.id, events);
        const scope = new PluginScope(this.actions, this.groups);
        assignScopeModule(
          scope,
          { id: plugin.id, app: false },
          Object.freeze(
            this.modules
              .filter((module) => module.id !== this.appId)
              .map((module) => Object.freeze({ id: module.id, metadata: module.metadata })),
          ),
          Object.freeze(
            this.modules.map((module) =>
              Object.freeze({
                id: module.id,
                app: module.id === this.appId,
                metadata: module.metadata,
                settings: module.settings,
                ui: module.ui,
              }),
            ),
          ),
          {
            translate: this.translator(),
            text: (key, fallback, values) => this.text(key, fallback, values),
            subscribe: this.subscribeTranslations,
          },
          this.lifecycle,
        );
        this.scopes.push(scope);
        scope.bindSlots(this.slotRuntime.bind(scope, plugin.id));
        scope.onClose(events.dispose);
        for (const action of plugin.actions) this.install(scope, action, plugin.id, events.events);
        for (const [index, view] of plugin.views.entries())
          if (this.slots.has(view.slot)) {
            const contribution = {
              id: view.id ?? `view:${index}`,
              component: view.component,
              key: view.key,
              order: view.order,
              when: view.when,
            };
            preserveContributionPath(view, contribution);
            scope.slots.attach(view.slot, contribution, {
              availability: view.availability ?? 'wait',
            });
          }
        try {
          const cleanup = plugin.setup?.({ app: scope, services: this.services });
          if (cleanup) scope.own(cleanup);
        } catch (error) {
          throw this.attribute(error, plugin.id, 'Setup');
        }
      }
      this.observe(new Set([...this.container!.observed, this.settings]));
      await this.container!.start(controller.signal, selected);
      if (controller.signal.aborted) {
        await this.stopPlugins(startIds);
        return result('blocked', ['Update cancelled by runtime shutdown.']);
      }
      this.setupComplete = true;
      for (const id of startIds) {
        if (controller.signal.aborted) break;
        this.lifecycleState.plugin(id, 'ready');
      }
      if (!controller.signal.aborted)
        this.lifecycleState.update({ phase: 'ready', cleanup: 'none' });
      if (!controller.signal.aborted) this.setReady(true);
      if (controller.signal.aborted) {
        this.setReady(false);
        await this.stopPlugins(startIds);
        return result('blocked', ['Update cancelled by runtime shutdown.']);
      }
      return result('applied');
    } catch (error) {
      let cleanupError: unknown;
      try {
        await this.stopPlugins(startIds);
      } catch (failure) {
        cleanupError = failure;
      }
      const failed = isFoundationStartupError(error) ? error.plugin : changed[0];
      for (const id of startIds)
        this.lifecycleState.plugin(id, id === failed ? 'failed' : 'blocked', {
          plugin: failed,
          message: 'Plugin update failed.',
        });
      this.lifecycleState.update({
        phase: 'failed',
        cleanup: cleanupError ? 'failed' : 'complete',
      });
      return result('failed', [
        error instanceof Error ? error.message : String(error),
        ...(cleanupError ? ['Cleanup also failed; restart is blocked.'] : []),
      ]);
    }
  }
  private unmount(): Promise<void> {
    if (this.stopCompletion) return this.stopCompletion.promise;
    const completion = (this.stopCompletion = deferred());
    this.setReady(false);
    // Rejections are reported even if a host ignores the returned promise.
    void completion.promise.catch((error) => this.reportLifecycleError(error));
    // A hook or observer may request stop during synchronous construction. Finish recording
    // ownership first; never dispose a half-created service from inside its own factory.
    if (this.updating) {
      this.updateController?.abort();
      void this.updating.then(
        () => this.teardown(completion),
        () => this.teardown(completion),
      );
    } else if (this.mounting) {
      this.lifecycleState.update({ cleanup: 'pending' });
      queueMicrotask(() => this.teardown(completion));
    } else this.teardown(completion);
    return completion.promise;
  }
  private teardown(completion: Deferred) {
    const previousCleanupFailed = this.lifecycle.get().cleanup === 'failed';
    this.tearingDown = true;
    const starting = this.startPending;
    this.startController?.abort();
    this.startController = undefined;
    if (this.mounted) this.setReady(false);
    this.lifecycleState.update({
      phase: 'stopping',
      operation: Object.freeze({ kind: 'stop', startedAt: Date.now() }),
      cleanup: 'pending',
      plugins: Object.freeze(
        this.lifecycle
          .get()
          .plugins.map((entry) =>
            entry.phase === 'failed'
              ? entry
              : Object.freeze({ ...entry, phase: 'stopping' as const }),
          ),
      ),
    });
    this.readyDeferred.reject(
      new Error('The runtime stopped before its services finished starting.'),
    );
    // Unregister immediately: cancellation and new-work gating cannot wait behind an async disposer.
    const earlyErrors: unknown[] = previousCleanupFailed
      ? [
          new Error(
            'Previous plugin update cleanup failed; external resource recovery is required.',
          ),
        ]
      : [];
    for (const { handle } of this.registrations) {
      try {
        handle.unregister();
      } catch (error) {
        earlyErrors.push(error);
      }
    }
    for (const scope of this.scopes) {
      try {
        scope.close();
      } catch (error) {
        earlyErrors.push(error);
      }
    }
    const tasks: Cleanup[] = [];
    if (starting && this.startWork)
      tasks.push(() =>
        this.startWork!.then(
          () => {},
          () => {},
        ),
      );
    const activeRuns = [...this.activeRuns.values()];
    if (activeRuns.length)
      tasks.push(() => Promise.all(activeRuns.map((run) => run.promise)).then(() => {}));
    tasks.push(
      ...this.scopes
        .splice(0)
        .reverse()
        .map((scope) => async () => {
          try {
            await scope.dispose();
          } catch (error) {
            const plugin = scopeModule(scope).id;
            const failure = Object.assign(
              new Error(`Cleanup in plugin "${plugin}" failed.`, { cause: error }),
              { plugin },
            );
            this.lifecycleState.plugin(plugin, 'failed', { plugin, message: failure.message });
            throw failure;
          }
        }),
    );
    if (this.container) tasks.push(() => this.container!.dispose());
    tasks.push(...this.extensionCleanups.splice(0).reverse());
    tasks.push(() => {
      for (const off of this.observations.values()) off();
      this.observations.clear();
      this.pluginEvents.clear();
    });
    void cleanupSequence(tasks, (errors) => {
      errors.unshift(...earlyErrors);
      try {
        this.settings.deactivate();
      } catch (error) {
        errors.push(error);
      }
      this.container = undefined;
      this.view = undefined;
      this.registrations = [];
      this.actionConfigs.clear();
      this.activeRuns.clear();
      this.startWork = undefined;
      this.startPending = false;
      this.setupComplete = false;
      this.publish(null);
      this.lifecycleState.update({
        phase: errors.length ? 'failed' : 'stopped',
        cleanup: errors.length ? 'failed' : 'complete',
        plugins: Object.freeze(
          this.lifecycle
            .get()
            .plugins.map((entry) =>
              entry.phase === 'failed'
                ? entry
                : Object.freeze({ ...entry, phase: 'stopped' as const }),
            ),
        ),
      });
      this.events.clear();
      for (const module of this.modules)
        if (module.events) this.events.declare(module.id, module.events);
      cleanupFailure(errors, 'Foundation cleanup failed.');
    }).then(
      () => {
        this.tearingDown = false;
        completion.resolve();
      },
      (error) => {
        this.tearingDown = false;
        completion.reject(error);
      },
    );
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
