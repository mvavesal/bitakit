import type { ActionReference, KnownActionId } from '../actions/core.js';
import type { ConfigMap } from '../config-service.js';
import type { Plugin, ServiceDefinition, ServiceMap } from '../definitions.js';
import type { ContractName } from '../service-key.js';
import type { SettingsOf } from '../settings/define.js';
import type { SettingsAccess } from '../settings/access.js';

/** @deprecated Augment `ServiceMap`; kept so older generated hosts still compile. */
export interface PublicServiceMap {}
/** Optional packages contribute their own typed facades without Core depending on them. */
export interface AppExtensionMap {}

type Intersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;
type Instance<D> = D extends ServiceDefinition<infer T> ? T : never;
type Exposed<D> = D extends { exposeAs: infer Alias extends string }
  ? { readonly [A in Alias]: Instance<D> }
  : {};
/** A contract created as `serviceKey<T, 'name'>('name')` types `services.name`; plain names add nothing. */
type Provided<D> = D extends { provides: infer Key }
  ? string extends ContractName<Key>
    ? {}
    : { readonly [A in ContractName<Key>]: Instance<D> }
  : {};
type RecordServices<Id extends string, R> = {
  readonly [K in keyof R & string as `${Id}.${K}`]: Instance<R[K]>;
} & Intersection<{ [K in keyof R & string]: Exposed<R[K]> & Provided<R[K]> }[keyof R & string]>;
type ArrayServices<D> = (D extends { id: infer Id extends string }
  ? { readonly [K in Id]: Instance<D> }
  : {}) &
  Exposed<D> &
  Provided<D>;
type PluginServices<P> = P extends { id: infer Id extends string; services: infer S }
  ? S extends readonly (infer D)[]
    ? Intersection<ArrayServices<D>>
    : S extends Readonly<Record<string, ServiceDefinition<any>>>
      ? RecordServices<Id, S>
      : {}
  : {};
/** `ServiceMap` entries of manually composed plugins, for `useFoundationApp<typeof plugins>()`. */
export type PublicServicesOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<
      Plugins[number] extends infer P ? (P extends unknown ? PluginServices<P> : never) : never
    >;

/** `SettingsMap` entries of manually composed plugins, including installed package plugins. */
export type PublicSettingsOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<
      Plugins[number] extends infer P
        ? P extends { id: infer Id extends string; settings: infer S }
          ? SettingsOf<S, Id>
          : {}
        : never
    >;

type AtPath<Path extends string, Value> = Path extends `${infer Head}.${infer Tail}`
  ? { readonly [K in Head]: AtPath<Tail, Value> }
  : { readonly [K in Path]: Value };
/** Dotted names become nested namespaces: `todos.items` is `services.todos.items`. */
export type Namespace<Entries extends object> = keyof Entries extends never
  ? {}
  : Intersection<{ [K in keyof Entries & string]: AtPath<K, Entries[K]> }[keyof Entries & string]>;
type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
export type FoundationActions = Namespace<{ [K in KnownActionId]: ActionReference<K> }>;

export interface FoundationApp<Services extends object = ServiceMap> extends AppExtensionMap {
  readonly events: import('../events/types.js').Events;
  readonly actions: FoundationActions;
  readonly config: Namespace<Immutable<ConfigMap>>;
  /** Live, typed access; reading a missing or not-yet-ready service throws a named error. */
  readonly services: Namespace<Services>;
  /** Typed setting handles of every plugin; values load after mount, defaults before. */
  readonly settings: SettingsAccess;
  readonly ready: boolean;
  /** Whether a service is available right now, by ID or alias. */
  has(service: string): boolean;
}
