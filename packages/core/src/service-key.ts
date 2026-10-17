import type { ServiceDefinition } from './definitions.js';

declare const serviceType: unique symbol;
declare const serviceName: unique symbol;
/**
 * A stable runtime name carrying a TypeScript contract. Share it between the plugin that
 * provides a service and the plugins that use it. The phantom is contravariant, so a richer
 * instance may satisfy a narrower contract. Created as `serviceKey<T, 'name'>('name')`, the
 * key also carries its literal name, which types `services.name` in the generated maps.
 */
export type ServiceKey<T, Name extends string = string> = Name & {
  readonly [serviceType]: (value: T) => void;
  readonly [serviceName]?: Name;
};
/** The literal name a key carries, or `string` for keys created without one. */
export type ContractName<Key> = Key extends { readonly [serviceName]?: infer Name extends string }
  ? Name
  : string;

/**
 * Low-level key creation; `defineContract(name).of<T>()` is the documented form. Pass both type
 * arguments (`serviceKey<T, 'name'>('name')`) to keep the literal name.
 */
export function serviceKey<T, const Name extends string = string>(id: Name): ServiceKey<T, Name> {
  if (!id.trim()) throw new Error('A service key must not be empty.');
  return id as ServiceKey<T, Name>;
}
/** A named contract waiting for its type: `defineContract('auth').of<AuthService>()`. */
export type ContractBuilder<Name extends string> = {
  /** The typed key. Its literal name types `services.<name>` for the service that `provides` it. */
  of<T>(): ServiceKey<T, Name>;
};
/**
 * Defines a service contract shared by the plugin that provides it and the plugins that use it.
 * The name is written once and stays literal: `defineContract('auth').of<AuthService>()`.
 */
export function defineContract<const Name extends string>(id: Name): ContractBuilder<Name> {
  const key = serviceKey<unknown, Name>(id);
  return Object.freeze({ of: <T>() => key as unknown as ServiceKey<T, Name> });
}

/** Reads a contract from a services object (tree or flat); throws a clear error when absent. */
export function getService<T>(services: object, key: ServiceKey<T>): T {
  let current: unknown = services;
  for (const segment of (key as string).split('.')) {
    if (!current || typeof current !== 'object' || !(segment in (current as object)))
      throw new Error(`Missing service "${key}".`);
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === undefined) throw new Error(`Missing service "${key}".`);
  return current as T;
}

export type ProvidedService<T> = ServiceDefinition<T> & { readonly provides: ServiceKey<T> };
