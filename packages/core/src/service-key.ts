import type { ServiceDefinition, Services } from './definitions.js';

declare const serviceType: unique symbol;
/** A stable runtime ID carrying an invariant TypeScript contract. Share it between providers and consumers. */
export type ServiceKey<T> = string & { readonly [serviceType]: (value: T) => T };

export function serviceKey<T>(id: string): ServiceKey<T> {
  if (!id.trim()) throw new Error('A service key must not be empty.');
  return id as ServiceKey<T>;
}

export function getService<T>(services: Partial<Services>, key: ServiceKey<T>): T {
  if (!Object.hasOwn(services, key)) throw new Error(`Missing service "${key}".`);
  return (services as Record<string, unknown>)[key] as T;
}

/** The provider must implement the shared contract; registration and cleanup use the normal container. */
export function provideService<T, const Name extends string>(
  key: ServiceKey<T>,
  definition: Omit<ServiceDefinition<NoInfer<T>>, 'id'> & { exposeAs: Name },
): ServiceDefinition<T> & { id: ServiceKey<T>; exposeAs: Name };
export function provideService<T>(
  key: ServiceKey<T>,
  definition: Omit<ServiceDefinition<NoInfer<T>>, 'id'>,
): ServiceDefinition<T> & { id: ServiceKey<T> };
export function provideService<T>(
  key: ServiceKey<T>,
  definition: Omit<ServiceDefinition<T>, 'id'>,
): ServiceDefinition<T> & { id: ServiceKey<T> } {
  return { ...definition, id: key };
}
