import { EventService, createEventScope } from './events/service.js';
import { ConfigService, type ConfigContext } from './config-service.js';
import type { ServiceDefinition, Services } from './definitions.js';
import type { SettingsAccess } from './settings/access.js';
import type { ServiceNames } from './service-names.js';
import { FoundationStartupError, isFoundationStartupError, moduleLabel } from './startup-error.js';
import { createStore, isObservable, isStore } from './store.js';
import { cleanupSequence, cleanupFailure, type Cleanup } from './lifecycle/cleanup.js';
import type { LifecyclePhase } from './lifecycle/state.js';

export type ServiceScope = {
  names: ServiceNames;
  appId: string;
  moduleOf(definition: ServiceDefinition<any>): string;
  sourceOf(definition: ServiceDefinition<any>): string | undefined;
};
export type Observable = { subscribe(listener: () => void): () => void };
type OwnedService = {
  id: string;
  module: string;
  source?: string;
  starts: ((context: { signal: AbortSignal }) => void | Promise<void>)[];
  stops: Cleanup[];
  release: Cleanup;
  active: boolean;
  starting: boolean;
  stopping: boolean;
  observed: Set<Observable>;
  completion?: Promise<void>;
};

/** Allocates ownership before initialization, so partial factory failures can be fully stopped. */
export function createServices(
  definitions: readonly ServiceDefinition<any>[],
  provided: Readonly<Record<string, unknown>> = {},
  configFor: (definition: ServiceDefinition<any>) => ConfigContext = () =>
    new ConfigService([{ id: 'app' }]).context('app'),
  decorate: (id: string, instance: any, active: () => boolean) => any = (_id, instance) => instance,
  events: EventService = new EventService(),
  scope?: ServiceScope,
  idOf: (definition: ServiceDefinition<any>) => string = (definition) => definition.id!,
  settings: SettingsAccess = Object.freeze({}) as SettingsAccess,
  onPhase: (id: string, phase: LifecyclePhase, error?: unknown) => void = () => {},
) {
  let active = true;
  let initialized = false;
  let stopping = false;
  let completion: Promise<void> | undefined;
  const pending = new Map<string, ServiceDefinition<any>>();
  const instances: Record<string, unknown> = Object.create(null);
  const observed = new Set<Observable>();
  const providedSources = new Set<Observable>();
  const owned: OwnedService[] = [];
  for (const [id, instance] of Object.entries(provided)) {
    instances[id] = decorate(id, instance, () => active);
    if (isObservable(instance)) {
      observed.add(instance);
      providedSources.add(instance);
    }
  }
  const requirements = (definition: ServiceDefinition<any>) =>
    (definition.requires ?? []).map((name) => ({
      name,
      key: scope ? scope.names.key(name) : name,
    }));
  const view = scope ? scope.names.tree(instances) : (instances as unknown as Services);
  const attributed = (error: unknown, service: OwnedService, phase: string) => {
    if (phase === 'onStart' && isFoundationStartupError(error)) return error;
    const message = `${phase} in ${scope ? moduleLabel(service.module, scope.appId) : service.module} failed: ${error instanceof Error ? error.message : String(error)}`;
    if (phase === 'onStart')
      return new FoundationStartupError(message, service.module, {
        cause: error,
        source: service.source,
        app: service.module === scope?.appId,
      });
    return Object.assign(new Error(message, { cause: error }), {
      name: 'FoundationCleanupError',
      plugin: service.module,
      service: service.id,
      source: service.source,
    });
  };
  const install = (entries: readonly ServiceDefinition<any>[]) => {
    for (const definition of entries) {
      const id = idOf(definition);
      if (!id) throw new Error('A service needs an ID: pass { id } for manual composition.');
      if (pending.has(id) || Object.hasOwn(instances, id))
        throw new Error(`Duplicate service "${id}".`);
      pending.set(id, definition);
    }
    while (pending.size) {
      let progressed = false;
      for (const [id, definition] of pending) {
        if (requirements(definition).some(({ key }) => !Object.hasOwn(instances, key))) continue;
        const owner = scope?.moduleOf(definition) ?? '';
        const eventScope = createEventScope(events, owner || undefined);
        const service: OwnedService = {
          id,
          module: owner,
          source: scope?.sourceOf(definition),
          starts: [],
          stops: [],
          release: eventScope.dispose,
          active: true,
          starting: false,
          stopping: false,
          observed: new Set(),
        };
        owned.push(service);
        onPhase(id, 'starting');
        let instance: unknown;
        try {
          instance = definition.create({
            events: eventScope.events,
            services: view,
            config: configFor(definition),
            settings,
            store: (initial) => {
              const store = createStore(initial);
              observed.add(store);
              service.observed.add(store);
              return store;
            },
            onStart: (hook) => {
              if (service.starting || service.stopping || stopping)
                throw new Error('Register onStart during service creation.');
              service.starts.push(hook);
            },
            onStop: (hook) => {
              if (service.stopping || stopping)
                throw new Error('Service cleanup registration is closed.');
              service.stops.push(hook);
            },
          });
        } catch (error) {
          onPhase(id, 'failed', error);
          if (!scope || isFoundationStartupError(error)) throw error;
          throw new FoundationStartupError(
            `Service "${id}" in ${moduleLabel(owner, scope.appId)} failed to start: ${error instanceof Error ? error.message : String(error)}`,
            owner,
            { cause: error, source: service.source, app: owner === scope.appId },
          );
        }
        if (isObservable(instance)) {
          observed.add(instance);
          service.observed.add(instance);
        }
        if (instance && typeof instance === 'object')
          for (const value of Object.values(instance as Record<string, unknown>))
            if (isStore(value)) {
              observed.add(value);
              service.observed.add(value);
            }
        instances[id] = decorate(id, instance, () => active && service.active);
        pending.delete(id);
        progressed = true;
      }
      if (!progressed) throw unresolved(pending, instances, requirements, scope, idOf);
    }
  };
  const initialize = () => {
    if (initialized) throw new Error('Services are already initialized.');
    initialized = true;
    install(definitions);
  };
  const start = async (signal: AbortSignal, modules?: ReadonlySet<string>) => {
    for (const service of owned) {
      if (modules && !modules.has(service.module)) continue;
      if (signal.aborted) return;
      service.starting = true;
      try {
        for (const hook of service.starts) {
          if (signal.aborted) return;
          await hook({ signal });
        }
        if (!signal.aborted) onPhase(service.id, 'ready');
      } catch (error) {
        onPhase(service.id, 'failed', error);
        throw attributed(error, service, 'onStart');
      }
    }
  };
  const stopService = (service: OwnedService): Promise<void> => {
    if (service.completion) return service.completion;
    service.stopping = true;
    let resolve!: () => void, reject!: (error: unknown) => void;
    service.completion = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    onPhase(service.id, 'stopping');
    void cleanupSequence([...service.stops].reverse(), (errors) => {
      try {
        service.release();
      } catch (error) {
        errors.push(error);
      }
      service.active = false;
      for (const source of service.observed) {
        if (
          !providedSources.has(source) &&
          !owned.some((other) => other !== service && other.active && other.observed.has(source))
        )
          observed.delete(source);
      }
      delete instances[service.id];
      onPhase(service.id, errors.length ? 'failed' : 'stopped', errors[0]);
      cleanupFailure(
        errors.map((error) => attributed(error, service, 'onStop')),
        `Service "${service.id}" cleanup failed.`,
      );
    }).then(resolve, reject);
    return service.completion;
  };
  const disposeModules = async (modules: ReadonlySet<string>) => {
    const selected = owned.filter((service) => modules.has(service.module));
    await cleanupSequence(
      [...selected].reverse().map((service) => () => stopService(service)),
      (errors) => {
        for (const service of selected) owned.splice(owned.indexOf(service), 1);
        for (const [id, definition] of pending)
          if (modules.has(scope?.moduleOf(definition) ?? '')) pending.delete(id);
        cleanupFailure(errors, 'Service cleanup failed.');
      },
    );
  };
  const dispose = (): Promise<void> => {
    if (completion) return completion;
    stopping = true;
    let resolve!: () => void, reject!: (error: unknown) => void;
    completion = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    void cleanupSequence(
      [...owned].reverse().map((service) => () => stopService(service)),
      (errors) => {
        active = false;
        observed.clear();
        cleanupFailure(errors, 'Service cleanup failed.');
      },
    ).then(resolve, reject);
    return completion;
  };
  return {
    services: instances as Readonly<Record<string, unknown>>,
    observed,
    initialize,
    install,
    disposeModules,
    get hasStartHooks() {
      return owned.some((service) => service.starts.length > 0);
    },
    start,
    dispose,
  };
}

/** Reports the first missing requirement, otherwise the dependency cycle that blocks startup. */
function unresolved(
  pending: ReadonlyMap<string, ServiceDefinition<any>>,
  instances: Readonly<Record<string, unknown>>,
  requirements: (definition: ServiceDefinition<any>) => { name: string; key: string }[],
  scope: ServiceScope | undefined,
  idOf: (definition: ServiceDefinition<any>) => string,
): Error {
  const exists = (key: string) => Object.hasOwn(instances, key) || pending.has(key);
  for (const [id, definition] of pending) {
    const missing = requirements(definition).find(({ key }) => !exists(key));
    if (!missing) continue;
    if (!scope) return new Error(`Missing service "${missing.name}" required by service "${id}".`);
    return scope.names.missing(
      scope.moduleOf(definition),
      missing.name,
      { label: `Service "${id}"`, source: scope.sourceOf(definition) },
      exists,
    );
  }
  const path: string[] = [];
  let current = pending.keys().next().value!;
  while (!path.includes(current)) {
    path.push(current);
    current = requirements(pending.get(current)!).find(({ key }) => pending.has(key))!.key;
  }
  const cycle = [...path.slice(path.indexOf(current)), current].join(' → ');
  const message = `Service dependency cycle: ${cycle}. Move the shared logic into a separate service that both can require.`;
  if (!scope) return new Error(message);
  const definition = pending.get(current)!;
  const owner = scope.moduleOf(definition);
  void idOf;
  return new FoundationStartupError(message, owner, {
    source: scope.sourceOf(definition),
    app: owner === scope.appId,
  });
}
