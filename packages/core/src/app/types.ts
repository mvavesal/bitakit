import type { ActionReference, KnownActionId } from '../actions/core.js';
import type { ConfigMap } from '../config-service.js';
import type { Plugin } from '../definitions.js';
import type { ServiceKey } from '../service-key.js';

/** Published contracts are exposed inside app.services. */
export type PublicServiceKeys = Readonly<Record<string, ServiceKey<any>>>;

/** Extended by app discovery; package installation alone does not declare availability. */
export interface PublicServiceMap {}
/** Optional packages contribute their own typed facades without Core depending on them. */
export interface AppExtensionMap {}

type Published<P> = P extends { publicServices: infer Keys extends PublicServiceKeys }
  ? { readonly [K in keyof Keys]: Keys[K] extends ServiceKey<infer T> ? T : never }
  : {};
type Intersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;
export type PublicServicesOf<Plugins extends readonly Plugin[]> = [Plugins[number]] extends [never]
  ? {}
  : Intersection<Published<Plugins[number]>>;

/** Service reads resolve the current runtime container; they never copy or own service state. */
type AtPath<Path extends string, Value> = Path extends `${infer Head}.${infer Tail}`
  ? { readonly [K in Head]: AtPath<Tail, Value> }
  : { readonly [K in Path]: Value };
/** The same dotted names drive generated completion and runtime namespaces. */
export type Namespace<Entries extends object> = keyof Entries extends never
  ? {}
  : Intersection<
      {
        [K in keyof Entries & string]: AtPath<K, Entries[K]>;
      }[keyof Entries & string]
    >;
type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
export type FoundationActions = Namespace<{ [K in KnownActionId]: ActionReference<K> }>;

export interface FoundationApp<Public extends object = PublicServiceMap> extends AppExtensionMap {
  readonly actions: FoundationActions;
  readonly config: Namespace<Immutable<ConfigMap>>;
  readonly services: Namespace<Public>;
  readonly ready: boolean;
  readonly optional: {
    readonly services: Namespace<{ [K in keyof Public]: Public[K] | undefined }>;
  };
}
