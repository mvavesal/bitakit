import type { ActionReference, KnownActionId } from '../actions/core.js';
import type { ConfigMap } from '../config-service.js';
import type { Plugin, ServiceDefinition, ServiceMap } from '../definitions.js';
import type { ContractName } from '../service-key.js';
import type { SettingsOf } from '../settings/define.js';
import type { SettingsAccess } from '../settings/access.js';
import type { ActionTree, SlotTree } from '../discovered.js';
import type { CancelableOf, EventsOf } from '../events/define.js';
import type { SlotEntry } from '../slots/define.js';

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
/** `ServiceMap` entries of manually composed plugins, for `useBitaKitApp<typeof plugins>()`. */
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

/**
 * `ActionMap` entries of manually composed or installed package plugins. Record keys become
 * `<plugin>.<key>`; array entries carry no literal ID type and add nothing.
 */
export type PublicActionsOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<
      Plugins[number] extends infer P
        ? P extends { id: infer Id extends string; actions: infer A }
          ? A extends readonly unknown[]
            ? {}
            : ActionTree<A, Id>
          : {}
        : never
    >;

/** `EventMap` entries of manually composed or installed package plugins. */
export type PublicEventsOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<
      Plugins[number] extends infer P
        ? P extends { id: infer Id extends string; events: infer E }
          ? EventsOf<E, Id>
          : {}
        : never
    >;

/** `CancelableEventMap` entries of manually composed or installed package plugins. */
export type PublicCancelableOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<
      Plugins[number] extends infer P
        ? P extends { id: infer Id extends string; events: infer E }
          ? CancelableOf<E, Id>
          : {}
        : never
    >;

/** Typed slot contracts from manual plugin records or explicit-ID arrays. */
export type PublicSlotsOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<
      Plugins[number] extends infer P
        ? P extends { id: infer Id extends string; slots: infer S }
          ? S extends readonly (infer D)[]
            ? [D] extends [never]
              ? {}
              : Intersection<D extends { id: infer Name extends string } ? SlotEntry<D, Name> : {}>
            : SlotTree<S, Id>
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
export type BitaKitActions = Namespace<{ [K in KnownActionId]: ActionReference<K> }>;

export interface BitaKitApp<Services extends object = ServiceMap> extends AppExtensionMap {
  /** Listen only: a plugin emits its own events through the scoped `events` of its services and Actions. */
  readonly events: Pick<import('../events/types.js').Events, 'on'>;
  readonly actions: BitaKitActions;
  readonly config: Namespace<Immutable<ConfigMap>>;
  /** Live, typed access; missing reads throw. Use has/service hooks for owner readiness. */
  readonly services: Namespace<Services>;
  /** Typed setting handles of every plugin; values load after mount, defaults before. */
  readonly settings: SettingsAccess;
  /** Initial startup completed; compatible updates retain this until full shutdown. */
  readonly ready: boolean;
  /** Whether a service and its owner are ready right now, by ID or alias. */
  has(service: string): boolean;
}
