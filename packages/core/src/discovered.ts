import { setContributionPath, setContributionSource } from './contribution-origin.js';
import {
  defineAction,
  defineService,
  isActionSpec,
  isServiceDefinition,
  type ActionSpec,
  type Contribution,
  type ServiceDefinition,
  type ActionEntry,
} from './definitions.js';
import { resolveContribution } from './conventions.js';
import { actionIdPattern } from './conventions.js';
import { isSlotDefinition, type ResolvedSlotDefinition, type SlotEntry } from './slots/define.js';
import { FoundationStartupError } from './startup-error.js';
import type { ContractName } from './service-key.js';
import { defineInterceptor, type InterceptorSpec } from './interceptors/define.js';
import {
  isEventsDefinition,
  type CancelableOf,
  type EventsDefinition,
  type EventsOf,
} from './events/define.js';
import {
  isConfigDefinition,
  isConfigObject,
  type ConfigValues,
  type ConfigDefinition,
} from './config-service.js';
import {
  isSettingsDefinition,
  type SettingsDefinition,
  type SettingsOf,
} from './settings/define.js';

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
function expand(
  files: readonly DiscoveredFile[],
  leaf: (value: any) => boolean,
  arrays = false,
  failure = (message: string, _source: string): Error => new Error(message),
) {
  const results: { value: any; path: string[]; source: string }[] = [];
  const seen = new Map<string, string>();
  function visit(value: any, segments: string[], source: string) {
    if (leaf(value)) {
      const key = segments.join('.');
      if (!key) throw failure(`Collection needs named entries: ${source}`, source);
      if (seen.has(key))
        throw failure(`Duplicate contribution "${key}": ${seen.get(key)} and ${source}`, source);
      seen.set(key, source);
      results.push({ value, path: segments, source });
      return;
    }
    if (arrays && Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...segments, String(index)], source));
      return;
    }
    if (!isConfigObject(value))
      throw failure(
        `Invalid contribution in ${source}: ${typeof value === 'function' ? 'class and factory exports are no longer discovered; export defineAction({ ... }) or defineService((context) => ...)' : 'expected a define* result or a record of them'}.`,
        source,
      );
    for (const [key, entry] of Object.entries(value))
      visit(entry, [...segments, ...key.split('.')], source);
  }
  for (const file of files) visit(file.value, file.path ? file.path.split('.') : [], file.source);
  return results;
}
const isActionLike = (value: unknown): value is ActionSpec =>
  isActionSpec(value) ||
  (!!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('execute' in value || 'href' in value || 'dialog' in value) &&
    !('create' in value) &&
    !('kind' in value));

export function discoverActions(files: readonly DiscoveredFile[], moduleId = ''): Contribution[] {
  return expand(files, isActionLike).map(({ value, path, source }) => {
    const spec = isActionSpec(value) ? value : defineAction(value as never);
    const resolved = resolveContribution(spec, [moduleId, ...path].filter(Boolean).join('.'));
    setContributionPath(resolved, path, source);
    return resolved;
  });
}
const isServiceLike = (value: unknown) => isServiceDefinition(value) || typeof value === 'function';
export function discoverServices(
  files: readonly DiscoveredFile[],
  moduleId = '',
): ServiceDefinition[] {
  return expand(files, isServiceLike).map(({ value, path, source }) => {
    const service: ServiceDefinition = isServiceDefinition(value)
      ? value
      : defineService(value as never);
    const definition = {
      ...service,
      id: service.id ?? [moduleId, ...path].filter(Boolean).join('.'),
    };
    setContributionSource(definition, source);
    return definition;
  });
}
/** Slot leaves use the same record/path expansion as Actions and services. Explicit IDs are absolute. */
export function discoverSlots(
  files: readonly DiscoveredFile[],
  moduleId = '',
): ResolvedSlotDefinition[] {
  const seen = new Map<string, string>();
  return expand(
    files,
    isSlotDefinition,
    false,
    (message, source) =>
      new FoundationStartupError(message, moduleId || 'app', { source, app: !moduleId }),
  ).map(({ value, path, source }) => {
    const id = value.id ?? [moduleId, ...path].filter(Boolean).join('.');
    if (typeof id !== 'string' || !actionIdPattern.test(id))
      throw new FoundationStartupError(`Invalid slot ID "${id}" in ${source}.`, moduleId || 'app', {
        source,
        app: !moduleId,
      });
    if (seen.has(id))
      throw new FoundationStartupError(
        `Duplicate slot "${id}": ${seen.get(id)} and ${source}.`,
        moduleId || 'app',
        { source, app: !moduleId },
      );
    seen.set(id, source);
    const definition = Object.freeze({ ...value, id });
    setContributionPath(definition, path, source);
    return definition;
  });
}
export function discoverInterceptors(files: readonly DiscoveredFile[]): InterceptorSpec[] {
  return expand(
    files,
    (value) =>
      typeof value === 'function' ||
      (!!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        ((value as any).kind === 'interceptor' ||
          typeof (value as any).before === 'function' ||
          typeof (value as any).after === 'function' ||
          typeof (value as any).onError === 'function')),
    true,
  ).map(({ value, source }) => {
    const spec: InterceptorSpec =
      typeof value === 'function'
        ? defineInterceptor({ before: value })
        : (value as any).kind === 'interceptor'
          ? { ...(value as InterceptorSpec) }
          : defineInterceptor(value as never);
    setContributionSource(spec, source);
    return spec;
  });
}
/** The one `events.ts` of a module. */
export function discoverEvents(files: readonly DiscoveredFile[]): EventsDefinition | undefined {
  if (!files.length) return undefined;
  if (files.length > 1)
    throw new Error(
      `A module declares its events in one file: ${files.map((file) => file.source).join(', ')}`,
    );
  const [file] = files;
  if (!isEventsDefinition(file.value))
    throw new Error(`${file.source} must default-export defineEvents({ ... }).`);
  return file.value;
}
/** The one `settings.ts` of a module. */
export function discoverSettings(files: readonly DiscoveredFile[]): SettingsDefinition | undefined {
  if (!files.length) return undefined;
  if (files.length > 1)
    throw new Error(
      `A module declares its settings in one file: ${files.map((file) => file.source).join(', ')}`,
    );
  const [file] = files;
  if (!isSettingsDefinition(file.value))
    throw new Error(`${file.source} must default-export defineSettings({ ... }).`);
  return file.value;
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

// ---------------------------------------------------------------------------------------------
// Types for generated declarations
// ---------------------------------------------------------------------------------------------
type Join<A extends string, B extends string> = A extends '' ? B : B extends '' ? A : `${A}.${B}`;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

/** `ActionMap` entries of an Action, or of a nested record of Actions under path `P`. */
export type ActionTree<T, P extends string> = T extends { kind: 'action' }
  ? ActionEntry<T, P>
  : T extends { execute: (...args: any[]) => any }
    ? ActionEntry<T & { kind: 'action' }, P>
    : T extends { href: string } | { dialog: unknown }
      ? ActionEntry<T & { kind: 'action' }, P>
      : T extends object
        ? UnionToIntersection<
            { [K in keyof T & string]: ActionTree<T[K], Join<P, K>> }[keyof T & string]
          >
        : {};
export type DiscoveredActionEntry<
  F,
  Module extends string = '',
  _Conventions extends boolean = true,
> = F extends DiscoveredFile<infer T, infer P> ? ActionTree<T, Join<Module, P>> : {};

type ServiceInstance<T> = T extends { create: (...args: any[]) => infer R }
  ? R
  : T extends (...args: any[]) => infer R
    ? R
    : never;
type ServiceId<T, P extends string> = T extends { id: infer Id extends string } ? Id : P;
type ServiceAlias<T, R> = (T extends { exposeAs: infer A extends string }
  ? { readonly [K in A]: R }
  : {}) &
  (T extends { provides: infer Key }
    ? string extends ContractName<Key>
      ? {}
      : { readonly [K in ContractName<Key>]: R }
    : {});
type ServiceTree<T, P extends string> = [ServiceInstance<T>] extends [never]
  ? T extends object
    ? UnionToIntersection<
        { [K in keyof T & string]: ServiceTree<T[K], Join<P, K>> }[keyof T & string]
      >
    : {}
  : { readonly [K in ServiceId<T, P>]: ServiceInstance<T> } & ServiceAlias<T, ServiceInstance<T>>;
export type DiscoveredServiceEntry<F, Module extends string = ''> =
  F extends DiscoveredFile<infer T, infer P> ? ServiceTree<T, Join<Module, P>> : {};

export type SlotTree<T, P extends string> = T extends { kind: 'slot' }
  ? SlotEntry<T, P>
  : T extends object
    ? [keyof T & string] extends [never]
      ? {}
      : UnionToIntersection<
          { [K in keyof T & string]: SlotTree<T[K], Join<P, K>> }[keyof T & string]
        >
    : {};
export type DiscoveredSlotEntry<F, Module extends string = ''> =
  F extends DiscoveredFile<infer T, infer P> ? SlotTree<T, Join<Module, P>> : {};

export type DiscoveredEventsEntry<F, Module extends string> =
  F extends DiscoveredFile<infer T, any> ? EventsOf<T, Module> : {};
export type DiscoveredCancelableEntry<F, Module extends string> =
  F extends DiscoveredFile<infer T, any> ? CancelableOf<T, Module> : {};
/** `SettingsMap` entries of one `settings.ts`; pass '' as Module for the app. */
export type DiscoveredSettingsEntry<F, Module extends string> =
  F extends DiscoveredFile<infer T, any> ? SettingsOf<T, Module> : {};

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
