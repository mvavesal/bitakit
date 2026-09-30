import { ConfigService, type ConfigContext } from './config-service.js';
import type { ServiceDefinition, Services } from './definitions.js';

export function createServices(
  definitions: readonly ServiceDefinition<any>[],
  provided: Partial<Services> = {},
  configFor: (definition: ServiceDefinition<any>) => ConfigContext = () =>
    new ConfigService([{ id: 'app' }]).context('app'),
  decorate: (id: string, instance: any, active: () => boolean) => any = (_id, instance) => instance,
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
  try {
    while (pending.size) {
      let progressed = false;
      for (const [id, definition] of pending) {
        if (definition.requires?.some((key) => !Object.hasOwn(instances, key))) continue;
        const instance = definition.create({
          services: instances as Services,
          config: configFor(definition),
        });
        if (definition.dispose) cleanups.push(() => definition.dispose!(instance));
        instances[id] = decorate(id, instance, () => active);
        pending.delete(id);
        progressed = true;
      }
      if (!progressed)
        throw new Error(
          `Missing or cyclic service dependencies: ${[...pending.keys()].join(', ')}.`,
        );
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { services: Object.freeze(instances) as Services, dispose };
}
