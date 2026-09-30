import { setContributionPath } from './contribution-origin.js';
import {
  defineAction,
  type Contribution,
  type ServiceDefinition,
  type InterceptorEntry,
  type ActionEntry,
} from './definitions.js';
import { resolveContribution } from './conventions.js';
import { serviceKey } from './service-key.js';
import type { PublicServiceKeys } from './app/types.js';
import {
  isConfigDefinition,
  isConfigObject,
  type ConfigValues,
  type ConfigDefinition,
} from './config-service.js';

export type DiscoveredFile<T = unknown, P extends string = string> = {
  value: T;
  path: P;
  source: string;
};
export function discoveredFile<T, const P extends string>(
  value: T,
  path: P,
  source: string,
): DiscoveredFile<T, P> {
  return { value, path, source };
}
function expand(files: readonly DiscoveredFile[], leaf: (value: any) => boolean, arrays = false) {
  const results: { value: any; path: string[]; source: string }[] = [];
  const seen = new Map<string, string>();
  function visit(value: any, segments: string[], source: string) {
    if (leaf(value)) {
      const key = segments.join('.');
      if (!key) throw new Error(`Collection needs named entries: ${source}`);
      if (seen.has(key))
        throw new Error(`Duplicate contribution "${key}": ${seen.get(key)} and ${source}`);
      seen.set(key, source);
      results.push({ value, path: segments, source });
      return;
    }
    if (arrays && Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...segments, String(index)], source));
      return;
    }
    if (!isConfigObject(value)) throw new Error(`Invalid contribution in ${source}`);
    for (const [key, entry] of Object.entries(value))
      visit(entry, [...segments, ...key.split('.')], source);
  }
  for (const file of files) visit(file.value, file.path ? file.path.split('.') : [], file.source);
  return results;
}
export function discoverActions(
  files: readonly DiscoveredFile[],
  moduleId = '',
  conventions = true,
): Contribution[] {
  return expand(
    files,
    (value) =>
      typeof value === 'function' ||
      (!!value &&
        typeof value === 'object' &&
        ('kind' in value || typeof value.execute === 'function')),
  ).map(({ value, path }) => {
    const definition = typeof value === 'object' && !value.kind ? defineAction(value) : value;
    const resolved = resolveContribution(
      definition,
      [moduleId, ...path].filter(Boolean).join('.'),
      conventions,
    );
    setContributionPath(resolved, path);
    return resolved;
  });
}
export function discoverServices(
  files: readonly DiscoveredFile[],
  moduleId = '',
): ServiceDefinition[] {
  return expand(files, (value) => !!value && typeof value.create === 'function').map(
    ({ value, path }) => ({
      ...value,
      id: value.id ?? [moduleId, ...path].filter(Boolean).join('.'),
    }),
  );
}
/** Public names follow explicit IDs or local file paths; storage IDs retain their module scope. */
export function discoverPublicServices(
  files: readonly DiscoveredFile[],
  moduleId = '',
): PublicServiceKeys {
  const aliases: Record<string, ReturnType<typeof serviceKey<any>>> = Object.create(null);
  const sources = new Map<string, string>();
  for (const { value, path, source } of expand(
    files,
    (value) => !!value && typeof value.create === 'function',
  )) {
    const name = value.id ?? path.join('.');
    if (sources.has(name))
      throw new Error(`Duplicate public service "${name}": ${sources.get(name)} and ${source}`);
    sources.set(name, source);
    aliases[name] = serviceKey(value.id ?? [moduleId, ...path].filter(Boolean).join('.'));
  }
  return aliases;
}
export function discoverInterceptors(files: readonly DiscoveredFile[]): InterceptorEntry[] {
  return expand(
    files,
    (value) =>
      typeof value === 'function' ||
      (!!value &&
        (value.kind === 'service' ||
          typeof value.create === 'function' ||
          typeof value.before === 'function')),
    true,
  ).map(({ value }) => (typeof value === 'function' ? { before: value } : value));
}
/** File assembly rejects overlapping leaves; intentional overrides happen later in ConfigService. */
export function discoverConfig(files: readonly DiscoveredFile[]): ConfigValues | ConfigDefinition {
  const schemaRoot = files.find((file) => !file.path && isConfigDefinition(file.value));
  if (schemaRoot) {
    if (files.length !== 1)
      throw new Error(`Root config schema must own the complete config: ${schemaRoot.source}`);
    return schemaRoot.value as ConfigDefinition;
  }
  const root: Record<string, unknown> = Object.create(null);
  const sources = new Map<string, string>();
  function insert(value: unknown, segments: string[], source: string) {
    if (
      isConfigObject(value) &&
      !isConfigDefinition(value) &&
      (Object.keys(value).length || !segments.length)
    ) {
      for (const [key, item] of Object.entries(value))
        insert(item, [...segments, ...key.split('.')], source);
      return;
    }
    if (!segments.length) throw new Error(`Root config must be an object: ${source}`);
    let target = root;
    for (let i = 0; i < segments.length; i++) {
      const key = segments[i];
      const prefix = segments.slice(0, i + 1).join('.');
      if (
        Object.hasOwn(target, key) &&
        (i === segments.length - 1 ||
          !isConfigObject(target[key]) ||
          isConfigDefinition(target[key]))
      )
        throw new Error(`Duplicate config path "${prefix}": ${sources.get(prefix)} and ${source}`);
      sources.set(prefix, sources.get(prefix) ?? source);
      if (i === segments.length - 1)
        Object.defineProperty(target, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      else {
        if (!Object.hasOwn(target, key))
          Object.defineProperty(target, key, { value: Object.create(null), enumerable: true });
        target = target[key] as Record<string, unknown>;
      }
    }
  }
  for (const file of files) insert(file.value, file.path ? file.path.split('.') : [], file.source);
  return root;
}
type Join<A extends string, B extends string> = A extends '' ? B : B extends '' ? A : `${A}.${B}`;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;
type ActionTree<T, P extends string> = T extends (...args: any[]) => any
  ? {}
  : T extends abstract new (...args: any[]) => any
    ? {}
    : T extends { kind: string }
      ? ActionEntry<T, P>
      : T extends { execute: (...args: any[]) => any }
        ? ActionEntry<T & { kind: 'action' }, P>
        : T extends object
          ? UnionToIntersection<
              { [K in keyof T & string]: ActionTree<T[K], Join<P, K>> }[keyof T & string]
            >
          : {};
export type DiscoveredActionEntry<
  F,
  Module extends string = '',
  Conventions extends boolean = true,
> =
  F extends DiscoveredFile<infer T, infer P>
    ? ActionTree<T, Conventions extends false ? never : Join<Module, P>>
    : {};
type ServiceTree<T, P extends string> = T extends { create: (...args: any[]) => infer R }
  ? { [K in T extends { id: infer ID extends string } ? ID : P]: R }
  : T extends object
    ? UnionToIntersection<
        { [K in keyof T & string]: ServiceTree<T[K], Join<P, K>> }[keyof T & string]
      >
    : {};
export type DiscoveredServiceEntry<F, Module extends string = ''> =
  F extends DiscoveredFile<infer T, infer P> ? ServiceTree<T, Join<Module, P>> : {};
export type DiscoveredPublicServiceEntry<F> = DiscoveredServiceEntry<F>;

type ConfigOutput<T> =
  T extends ConfigDefinition<infer V>
    ? V
    : T extends readonly unknown[]
      ? T
      : T extends object
        ? { [K in keyof T]: ConfigOutput<T[K]> }
        : T;
type ConfigTree<T, P extends string> = P extends ''
  ? ConfigOutput<T>
  : P extends `${infer Head}.${infer Tail}`
    ? { [K in Head]: ConfigTree<T, Tail> }
    : { [K in P]: ConfigOutput<T> };
export type DiscoveredConfigEntry<F> =
  F extends DiscoveredFile<infer T, infer P> ? ConfigTree<T, P> : {};
