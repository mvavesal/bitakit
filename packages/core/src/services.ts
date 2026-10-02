import { EventService, createEventScope } from './events/service.js';
import { ConfigService, type ConfigContext } from './config-service.js';
import type { ServiceDefinition, Services } from './definitions.js';
import type { ServiceNames } from './service-names.js';
import { FoundationStartupError, isFoundationStartupError, moduleLabel } from './startup-error.js';
import { createStore, isObservable, isStore } from './store.js';

/** Name resolution and module ownership for error attribution. */
export type ServiceScope = {
  names: ServiceNames;
  appId: string;
  moduleOf(definition: ServiceDefinition<any>): string;
  sourceOf(definition: ServiceDefinition<any>): string | undefined;
};
export type Observable = { subscribe(listener: () => void): () => void };
type StartHook = {
  module: string;
  source?: string;
  run(context: { signal: AbortSignal }): void | Promise<void>;
};

/**
 * Creates every service in dependency order and hands each factory one context object.
 * Returns the instances by ID, everything observable the runtime should follow, and the
 * start hooks to await before the app is ready.
 */
export function createServices(
  definitions: readonly ServiceDefinition<any>[],
  provided: Readonly<Record<string, unknown>> = {},
  configFor: (definition: ServiceDefinition<any>) => ConfigContext = () =>
    new ConfigService([{ id: 'app' }]).context('app'),
  decorate: (id: string, instance: any, active: () => boolean) => any = (_id, instance) => instance,
  events: EventService = new EventService(),
  scope?: ServiceScope,
  idOf: (definition: ServiceDefinition<any>) => string = (definition) => definition.id!,
) {
  let active = true;
  const pending = new Map<string, ServiceDefinition<any>>();
  const instances: Record<string, unknown> = Object.create(null);
  const observed = new Set<Observable>();
  const startHooks: StartHook[] = [];
  const stopHooks: { module: string; run(): void | Promise<void> }[] = [];
  const cleanups: (() => void)[] = [];
  for (const [id, instance] of Object.entries(provided)) {
    instances[id] = decorate(id, instance, () => active);
    if (isObservable(instance)) observed.add(instance);
  }
  const dispose = () => {
    active = false;
    const errors: unknown[] = [];
    for (const hook of stopHooks.splice(0).reverse()) {
      try {
        const result = hook.run();
        if (result && typeof (result as Promise<void>).then === 'function')
          void (result as Promise<void>).catch((error) =>
            console.error(`[bitakit] onStop in ${hook.module} failed.`, error),
          );
      } catch (error) {
        errors.push(error);
      }
    }
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    observed.clear();
    if (errors.length) throw new AggregateError(errors, 'Service cleanup failed.');
  };
  for (const definition of definitions) {
    const id = idOf(definition);
    if (!id) throw new Error('A service needs an ID: pass { id } for manual composition.');
    if (pending.has(id) || Object.hasOwn(instances, id))
      throw new Error(`Duplicate service "${id}".`);
    pending.set(id, definition);
  }
  const module = (definition: ServiceDefinition<any>) => scope?.moduleOf(definition) ?? '';
  const requirements = (definition: ServiceDefinition<any>) =>
    (definition.requires ?? []).map((name) => ({
      name,
      key: scope ? scope.names.key(name) : name,
    }));
  const view = scope ? scope.names.tree(instances) : (instances as unknown as Services);
  try {
    while (pending.size) {
      let progressed = false;
      for (const [id, definition] of pending) {
        if (requirements(definition).some(({ key }) => !Object.hasOwn(instances, key))) continue;
        const owner = module(definition);
        const eventScope = createEventScope(events, owner || undefined);
        cleanups.push(eventScope.dispose);
        let instance: unknown;
        try {
          instance = definition.create({
            events: eventScope.events,
            services: view,
            config: configFor(definition),
            store: (initial) => {
              const store = createStore(initial);
              observed.add(store);
              return store;
            },
            onStart: (hook) =>
              startHooks.push({ module: owner, source: scope?.sourceOf(definition), run: hook }),
            onStop: (hook) => stopHooks.push({ module: owner, run: hook }),
          });
        } catch (error) {
          if (!scope || isFoundationStartupError(error)) throw error;
          throw new FoundationStartupError(
            `Service "${id}" in ${moduleLabel(owner, scope.appId)} failed to start: ${error instanceof Error ? error.message : String(error)}`,
            owner,
            { cause: error, source: scope.sourceOf(definition), app: owner === scope.appId },
          );
        }
        if (isObservable(instance)) observed.add(instance);
        if (instance && typeof instance === 'object')
          for (const value of Object.values(instance as Record<string, unknown>))
            if (isStore(value)) observed.add(value);
        instances[id] = decorate(id, instance, () => active);
        pending.delete(id);
        progressed = true;
      }
      if (!progressed) throw unresolved(pending, instances, requirements, scope, idOf);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  const start = async (signal: AbortSignal) => {
    for (const hook of startHooks) {
      if (signal.aborted) return;
      try {
        await hook.run({ signal });
      } catch (error) {
        if (isFoundationStartupError(error)) throw error;
        throw new FoundationStartupError(
          `onStart in ${scope ? moduleLabel(hook.module, scope.appId) : hook.module} failed: ${error instanceof Error ? error.message : String(error)}`,
          hook.module,
          { cause: error, source: hook.source, app: scope ? hook.module === scope.appId : false },
        );
      }
    }
  };
  return {
    services: Object.freeze(instances) as Readonly<Record<string, unknown>>,
    observed,
    hasStartHooks: startHooks.length > 0,
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
