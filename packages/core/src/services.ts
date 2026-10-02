import { EventService, createEventScope } from './events/service.js';
import type { Events } from './events/types.js';
import { ConfigService, type ConfigContext } from './config-service.js';
import type { ServiceDefinition, Services } from './definitions.js';
import type { ServiceNames } from './service-names.js';
import { FoundationStartupError, isFoundationStartupError, moduleLabel } from './startup-error.js';

/** Name resolution and module ownership for error attribution; absent for bare containers. */
export type ServiceScope = {
  names: ServiceNames;
  appId: string;
  moduleOf(definition: ServiceDefinition<any>): string;
  sourceOf(definition: ServiceDefinition<any>): string | undefined;
};

export function createServices(
  definitions: readonly ServiceDefinition<any>[],
  provided: Partial<Services> = {},
  configFor: (definition: ServiceDefinition<any>) => ConfigContext = () =>
    new ConfigService([{ id: 'app' }]).context('app'),
  decorate: (id: string, instance: any, active: () => boolean) => any = (_id, instance) => instance,
  events: Events = new EventService(),
  scope?: ServiceScope,
) {
  let active = true;
  const pending = new Map<string, ServiceDefinition<any>>();
  const instances: Record<string, unknown> = Object.create(null);
  for (const [id, instance] of Object.entries(provided))
    instances[id] = decorate(id, instance, () => active);
  const cleanups: (() => void)[] = [];
  const dispose = () => {
    active = false;
    const errors: unknown[] = [];
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Service cleanup failed.');
  };
  for (const definition of definitions) {
    if (pending.has(definition.id) || Object.hasOwn(instances, definition.id))
      throw new Error(`Duplicate service "${definition.id}".`);
    pending.set(definition.id, definition);
  }
  const module = (definition: ServiceDefinition<any>) => scope?.moduleOf(definition) ?? '';
  const requirements = (definition: ServiceDefinition<any>) =>
    (definition.requires ?? []).map((name) => ({ name, key: scope ? scope.names.key(name) : name }));
  // Names mean the same service in every module, so one live view serves every factory.
  const view = scope ? scope.names.view(instances) : (instances as Services);
  try {
    while (pending.size) {
      let progressed = false;
      for (const [id, definition] of pending) {
        if (requirements(definition).some(({ key }) => !Object.hasOwn(instances, key))) continue;
        const eventScope = createEventScope(events);
        cleanups.push(eventScope.dispose);
        let instance: unknown;
        try {
          instance = definition.create({
            events: eventScope.events,
            services: view,
            config: configFor(definition),
          });
        } catch (error) {
          if (!scope || isFoundationStartupError(error)) throw error;
          const owner = module(definition);
          throw new FoundationStartupError(
            `Service "${id}" in ${moduleLabel(owner, scope.appId)} failed to start: ${error instanceof Error ? error.message : String(error)}`,
            owner,
            { cause: error, source: scope.sourceOf(definition), app: owner === scope.appId },
          );
        }
        if (definition.dispose) cleanups.push(() => definition.dispose!(instance));
        instances[id] = decorate(id, instance, () => active);
        pending.delete(id);
        progressed = true;
      }
      if (!progressed) throw unresolved(pending, instances, requirements, scope);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { services: Object.freeze(instances) as Services, dispose };
}

/** Reports the first missing requirement, otherwise the dependency cycle that blocks startup. */
function unresolved(
  pending: ReadonlyMap<string, ServiceDefinition<any>>,
  instances: Readonly<Record<string, unknown>>,
  requirements: (definition: ServiceDefinition<any>) => { name: string; key: string }[],
  scope: ServiceScope | undefined,
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
      [...Object.keys(instances), ...pending.keys()],
    );
  }
  // Every requirement exists, so the remaining services wait for each other.
  const path: string[] = [];
  let current = pending.keys().next().value!;
  while (!path.includes(current)) {
    path.push(current);
    current = requirements(pending.get(current)!).find(({ key }) => pending.has(key))!.key;
  }
  const cycle = [...path.slice(path.indexOf(current)), current].join(' → ');
  const message = `Service dependency cycle: ${cycle}. Move the shared logic into a separate service that both can require.`;
  if (!scope) return new Error(message);
  const owner = scope.moduleOf(pending.get(current)!);
  return new FoundationStartupError(message, owner, {
    source: scope.sourceOf(pending.get(current)!),
    app: owner === scope.appId,
  });
}
