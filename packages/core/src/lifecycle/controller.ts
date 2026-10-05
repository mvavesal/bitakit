import { createActionList, type ActionList } from '../actions/core.js';
import type { FoundationConfig, Plugin } from '../definitions.js';
import { FoundationRuntime } from '../runtime.js';
import { isFoundationStartupError } from '../startup-error.js';
import { createStore } from '../store.js';
import { resolveFoundationConfig } from '../configuration.js';
import { notifyLifecycleObserver, type LifecycleEntry, type LifecyclePhase } from './state.js';

export type FailurePolicy = 'fail-fast' | 'isolate';
export type StartupFailure = Readonly<{
  plugin: string;
  app: boolean;
  message: string;
  source?: string;
}>;
export type RuntimeControllerSnapshot = Readonly<{
  runtime?: FoundationRuntime;
  phase: LifecyclePhase;
  failures: readonly StartupFailure[];
  blocked: readonly string[];
  plugins: readonly LifecycleEntry[];
}>;
export type RuntimeControllerOptions = {
  actions?: ActionList;
  services?: Readonly<Record<string, unknown>>;
  failures?: FailurePolicy;
};

export function describeStartupFailure(error: unknown, appId = 'app'): StartupFailure {
  return isFoundationStartupError(error)
    ? { plugin: error.plugin, app: error.app, message: error.message, source: error.source }
    : { plugin: appId, app: true, message: error instanceof Error ? error.message : String(error) };
}

/** IDs and aliases from declarations, including record keys before normalization. */
export function pluginServiceNames(plugin: Plugin): string[] {
  const entries = Array.isArray(plugin.services)
    ? plugin.services.map(
        (value) => [value.id ?? (value.provides as string | undefined), value] as const,
      )
    : Object.entries(plugin.services ?? {}).map(
        ([name, value]) => [value.id ?? `${plugin.id}.${name}`, value] as const,
      );
  return entries.flatMap(([id, service]) =>
    [id, service.exposeAs, service.provides as string | undefined].filter(
      (name): name is string => !!name,
    ),
  );
}
export function pluginExposesService(plugin: Plugin, name: string): boolean {
  return pluginServiceNames(plugin).some(
    (candidate) => candidate === name || candidate.startsWith(`${name}.`),
  );
}

/** Shared dependency closure for headless and React hosts; configured intent is never mutated. */
export function failedPluginClosure(
  plugins: readonly Plugin[],
  failures: readonly StartupFailure[],
): Set<string> {
  const off = new Set(failures.map((failure) => failure.plugin));
  for (let changed = true; changed; ) {
    changed = false;
    const unavailable = new Set(
      plugins.filter((plugin) => off.has(plugin.id)).flatMap(pluginServiceNames),
    );
    const unavailableProviders = new Set(
      plugins
        .filter((plugin) => off.has(plugin.id))
        .flatMap((plugin) => plugin.ui?.providers?.map((provider) => provider.id) ?? []),
    );
    for (const plugin of plugins) {
      const requirements = [
        ...(plugin.dependencies ?? []).map((id) => off.has(id)),
        ...Object.values(plugin.services ?? {})
          .flatMap((value) => value.requires ?? [])
          .map((name) => unavailable.has(name)),
        ...Object.values(plugin.actions ?? {})
          .flatMap((value) => value.requires ?? [])
          .map((name) => unavailable.has(name)),
        ...(plugin.interceptors ?? [])
          .flatMap((value) => value.requires ?? [])
          .map((name) => unavailable.has(name)),
        ...(plugin.ui?.providers ?? [])
          .flatMap((value) => value.requires ?? [])
          .map((name) => unavailableProviders.has(name)),
      ];
      if (!off.has(plugin.id) && requirements.some(Boolean)) {
        off.add(plugin.id);
        changed = true;
      }
    }
  }
  return off;
}

/**
 * Core startup policy around the existing runtime, not incremental plugin replacement.
 * Each retry fully stops its previous composition before constructing/starting another.
 */
export class RuntimeController {
  private readonly actions: ActionList;
  private readonly appId: string;
  private failures: StartupFailure[] = [];
  private off = new Set<string>();
  private readonly store = createStore<RuntimeControllerSnapshot>(
    Object.freeze({
      phase: 'idle',
      failures: Object.freeze([]),
      blocked: Object.freeze([]),
      plugins: Object.freeze([]),
    }),
  );
  private releaseState?: () => void;
  private running = false;
  private generation = 0;
  private stopPromise?: Promise<void>;
  private startup: Promise<void> = Promise.resolve();
  private resolveReady: () => void = () => {};
  private rejectReady: (error: unknown) => void = () => {};
  get = this.store.get;
  subscribe = (listener: () => void) =>
    this.store.subscribe(() =>
      notifyLifecycleObserver(listener, (error) =>
        console.error('[bitakit] Runtime observer failed.', error),
      ),
    );
  get ready() {
    return this.startup;
  }
  get stopped() {
    return this.stopPromise ?? Promise.resolve();
  }

  constructor(
    readonly config: FoundationConfig,
    private readonly options: RuntimeControllerOptions = {},
  ) {
    this.actions = options.actions ?? createActionList();
    this.appId = config.appId ?? 'app';
    this.prepare();
  }
  private publish(runtime: FoundationRuntime | undefined, phase: LifecyclePhase) {
    const failed = new Map(this.failures.map((failure) => [failure.plugin, failure]));
    const states = new Map(runtime?.lifecycle.get().plugins.map((entry) => [entry.id, entry]));
    const ids = [this.appId, ...(this.config.plugins ?? []).map((plugin) => plugin.id)];
    const plugins = ids.map((id): LifecycleEntry => {
      const failure = failed.get(id);
      const phase = failure
        ? 'failed'
        : this.off.has(id)
          ? 'blocked'
          : (states.get(id)?.phase ?? 'idle');
      const previous = this.store.get().plugins.find((entry) => entry.id === id);
      return Object.freeze({
        id,
        plugin: id,
        enabled: true,
        phase,
        since:
          states.get(id)?.phase === phase
            ? states.get(id)!.since
            : previous?.phase === phase
              ? previous.since
              : Date.now(),
        ...(failure ? { failure } : {}),
      });
    });
    this.store.set(
      Object.freeze({
        runtime,
        phase,
        plugins: Object.freeze(plugins),
        failures: Object.freeze([...this.failures]),
        blocked: Object.freeze([...this.off].filter((id) => !failed.has(id))),
      }),
    );
  }
  private isolate(error: unknown): boolean {
    if (this.options.failures !== 'isolate') return false;
    const failure = describeStartupFailure(error, this.appId);
    if (failure.app || this.failures.some((entry) => entry.plugin === failure.plugin)) return false;
    this.failures.push(Object.freeze(failure));
    this.off = failedPluginClosure(this.config.plugins ?? [], this.failures);
    return true;
  }
  private prepare() {
    this.releaseState?.();
    for (;;) {
      try {
        const active = this.config.plugins?.filter((plugin) => !this.off.has(plugin.id));
        const removedProviders = new Set(
          (this.config.plugins ?? [])
            .filter((plugin) => this.off.has(plugin.id))
            .flatMap((plugin) => plugin.ui?.providers ?? []),
        );
        // UI composition may already project plugin providers into the app list. Remove
        // those same declarations and disabled config overrides when isolating their owner.
        const selected = {
          ...this.config,
          plugins: active,
          configOverrides:
            this.config.configOverrides &&
            Object.fromEntries(
              Object.entries(this.config.configOverrides).filter(([id]) => !this.off.has(id)),
            ),
          ui: this.config.ui && {
            ...this.config.ui,
            providers: this.config.ui.providers?.filter(
              (provider) => !removedProviders.has(provider),
            ),
          },
        };
        if (selected.ui?.providers)
          resolveFoundationConfig(selected, { providers: selected.ui.providers });
        const runtime = new FoundationRuntime(this.actions, selected, this.options.services);
        this.publish(runtime, 'idle');
        this.releaseState = runtime.lifecycle.subscribe(() =>
          this.publish(
            runtime,
            this.get().phase === 'failed' ? 'failed' : runtime.lifecycle.get().phase,
          ),
        );
        return;
      } catch (error) {
        if (this.isolate(error)) continue;
        if (this.options.failures !== 'isolate') throw error;
        this.failures.push(Object.freeze(describeStartupFailure(error, this.appId)));
        this.publish(undefined, 'failed');
        return;
      }
    }
  }
  mount(): () => Promise<void> {
    if (this.get().runtime?.lifecycle.get().cleanup === 'failed')
      throw new Error(
        'Cannot restart after failed cleanup. Recover resources before creating another controller.',
      );
    if (this.running || this.get().phase === 'stopping')
      throw new Error('Runtime controller is already mounted or stopping.');
    if (this.generation) {
      this.failures = [];
      this.off.clear();
      this.prepare();
    }
    this.running = true;
    this.stopPromise = undefined;
    const generation = ++this.generation;
    this.startup = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    void this.startup.catch(() => {});
    const attempt = () => {
      if (!this.running || generation !== this.generation) return;
      const runtime = this.get().runtime;
      if (!runtime) {
        const error = new Error(this.failures.map((failure) => failure.message).join('\n'));
        this.rejectReady(error);
        return;
      }
      const fail = (error: unknown) => {
        if (!this.running || generation !== this.generation) return;
        if (this.isolate(error)) {
          this.publish(runtime, 'stopping');
          void runtime.stop().then(() => {
            if (!this.running || generation !== this.generation) return;
            this.prepare();
            attempt();
          }, fatal);
        } else fatal(error);
      };
      const fatal = (error: unknown) => {
        if (!this.running || generation !== this.generation) return;
        const failure = describeStartupFailure(error, this.appId);
        if (!this.failures.some((entry) => entry.message === failure.message))
          this.failures.push(Object.freeze(failure));
        this.publish(runtime, 'failed');
        this.rejectReady(error);
      };
      try {
        runtime.mount();
      } catch (error) {
        if (this.options.failures !== 'isolate') {
          fatal(error);
          throw error;
        }
        fail(error);
        return;
      }
      void runtime.ready.then(() => {
        if (!this.running || generation !== this.generation) return;
        this.publish(runtime, 'ready');
        this.resolveReady();
      }, fail);
    };
    attempt();
    let completion: Promise<void> | undefined;
    return () => (completion ??= generation === this.generation ? this.stop() : Promise.resolve());
  }
  stop = (): Promise<void> => {
    if (this.stopPromise) return this.stopPromise;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    this.stopPromise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    void this.stopPromise.catch(() => {});
    this.running = false;
    this.rejectReady(new Error('Runtime controller stopped before startup completed.'));
    const runtime = this.get().runtime;
    this.publish(runtime, 'stopping');
    void (runtime?.stop() ?? Promise.resolve()).then(
      () => {
        this.releaseState?.();
        this.releaseState = undefined;
        this.publish(runtime, 'stopped');
        resolve();
      },
      (error) => {
        this.publish(runtime, 'failed');
        reject(error);
      },
    );
    return this.stopPromise;
  };
}

export function createRuntimeController(
  config: FoundationConfig,
  options: RuntimeControllerOptions = {},
) {
  return new RuntimeController(config, options);
}
