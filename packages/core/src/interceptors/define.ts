import type { ActionContext } from '../actions/types.js';
import type { ConfigContext } from '../config-service.js';
import type { Services, Translator } from '../definitions.js';
import type { BitaKitApp } from '../app/types.js';
import type { ServiceMap } from '../definitions.js';

/** Exact IDs, `todos.*` for one plugin, `*` for everything. */
export type InterceptorTarget = string | readonly string[];

export type ActionInterceptorContext = ActionContext & {
  services: Services;
  config: ConfigContext;
  app: BitaKitApp;
  translate: Translator;
};
/** Returning `false` cancels the action (skipped with reason "intercepted"). */
export type ActionInterceptorSpec = {
  readonly kind?: 'interceptor';
  action: InterceptorTarget;
  service?: never;
  method?: never;
  order?: number;
  /** `plugin` (default) limits matching to the interceptor's own plugin; `global` sees every plugin. */
  scope?: 'plugin' | 'global';
  requires?: readonly string[];
  before?(context: ActionInterceptorContext): boolean | void | Promise<boolean | void>;
  after?(context: ActionInterceptorContext & { readonly result: unknown }): void | Promise<void>;
  onError?(context: ActionInterceptorContext & { readonly error: unknown }): void | Promise<void>;
};

type Methods<S> = {
  [K in keyof S & string]: S[K] extends (...args: any[]) => any ? K : never;
}[keyof S & string];
type ServiceOf<Name extends string> = Name extends keyof ServiceMap
  ? NonNullable<ServiceMap[Name]>
  : Record<string, (...args: any[]) => unknown>;
type MethodOf<Name extends string, Key extends string> = Key extends keyof ServiceOf<Name>
  ? Extract<ServiceOf<Name>[Key], (...args: any[]) => any>
  : (...args: any[]) => unknown;
export type ServiceCall<Name extends string = string, Key extends string = string> = {
  readonly service: Name;
  readonly method: Key;
  readonly args: Readonly<Parameters<MethodOf<Name, Key>>>;
};
/** Observes one method or every public method of a service. Hooks never change the outcome. */
export type ServiceInterceptorSpec<Name extends string = string, Key extends string = string> = {
  readonly kind?: 'interceptor';
  service: Name | readonly string[];
  method?: Key;
  action?: never;
  scope?: never;
  requires?: never;
  order?: number;
  before?(call: ServiceCall<Name, Key>): void;
  after?(
    call: ServiceCall<Name, Key> & { readonly result: Awaited<ReturnType<MethodOf<Name, Key>>> },
  ): void;
  onError?(call: ServiceCall<Name, Key> & { readonly error: unknown }): void;
};
export type InterceptorSpec = (ActionInterceptorSpec | ServiceInterceptorSpec<any, any>) & {
  readonly kind: 'interceptor';
};

/**
 * One helper for both targets. `action` gates and observes actions; `service` observes service
 * methods. A definition without a target observes every action of its own plugin.
 */
export function defineInterceptor(spec: ActionInterceptorSpec): InterceptorSpec;
export function defineInterceptor<
  const Name extends string,
  const Key extends Methods<ServiceOf<Name>> = Methods<ServiceOf<Name>>,
>(spec: ServiceInterceptorSpec<Name, Key>): InterceptorSpec;
export function defineInterceptor(
  spec: Omit<ActionInterceptorSpec, 'action'> & { action?: undefined },
): InterceptorSpec;
export function defineInterceptor(spec: Record<string, unknown>): InterceptorSpec {
  if (!spec || typeof spec !== 'object') throw new Error('defineInterceptor expects an object.');
  if (
    'action' in spec &&
    spec.action !== undefined &&
    'service' in spec &&
    spec.service !== undefined
  )
    throw new Error(
      'An interceptor targets either actions or a service, not both. Export an array with one entry for each.',
    );
  const resolved =
    'service' in spec && spec.service !== undefined ? spec : { action: '*', ...spec };
  return { ...resolved, kind: 'interceptor' } as InterceptorSpec;
}
export function isServiceInterceptor(
  spec: object,
): spec is ServiceInterceptorSpec & { kind: 'interceptor' } {
  return 'service' in spec && (spec as { service?: unknown }).service !== undefined;
}

/** Glob matching for action IDs and service names: exact, `prefix.*`, or `*`. */
export function matchesTarget(target: InterceptorTarget, id: string): boolean {
  const patterns = typeof target === 'string' ? [target] : target;
  return patterns.some((pattern) =>
    pattern === '*'
      ? true
      : pattern.endsWith('.*')
        ? id.startsWith(pattern.slice(0, -1))
        : pattern === id,
  );
}
