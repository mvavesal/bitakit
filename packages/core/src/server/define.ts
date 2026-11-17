import {
  defineAction as defineAnyAction,
  defineService as defineAnyService,
  type InputSchema,
  type SchemaOutput,
  type ServiceDefinition,
  type ServiceOptions,
} from '../definitions.js';
import {
  defineInterceptor as defineAnyInterceptor,
  type InterceptorSpec,
  type ServiceInterceptorSpec,
} from '../interceptors/define.js';
import type { ServiceKey } from '../service-key.js';
import type { Access } from '../request-context.js';
import type {
  ServerActionSpec,
  ServerActionSpecInput,
  ServerInterceptorSpec,
  ServerServiceContext,
} from './types.js';

// The same runtime functions as the root entry (one helper per concept); only the types differ.

type Returned<Output, Result> = [Output] extends [undefined]
  ? Awaited<Result>
  : SchemaOutput<Output>;
type ContractOf<Key> = Key extends ServiceKey<infer Contract, string> ? Contract : unknown;

/**
 * A server Action: the operation behind a button, in `server/actions/<name>.ts`. `access` is
 * required; `expose: true` publishes it over HTTP and in `remote`. Client-only fields are type
 * errors and startup errors.
 */
export const defineAction = defineAnyAction as unknown as {
  <
    S extends InputSchema<any>,
    const A extends Access,
    Result = unknown,
    Output extends InputSchema<any> | undefined = undefined,
  >(
    spec: ServerActionSpecInput<SchemaOutput<S>, Result, A> & { input: S; output?: Output },
  ): ServerActionSpec<SchemaOutput<S>, Returned<Output, Result>, A>;
  <
    const A extends Access,
    Result = unknown,
    Output extends InputSchema<any> | undefined = undefined,
  >(
    spec: ServerActionSpecInput<undefined, Result, A> & { input?: undefined; output?: Output },
  ): ServerActionSpec<undefined, Returned<Output, Result>, A>;
};

/**
 * A server service: a process singleton (never per-user state). Methods take the request's `ctx`
 * as an argument; settings load per request with `settings.<plugin>.<name>.load(ctx)`.
 */
export const defineService = defineAnyService as unknown as {
  <
    const Options extends ServiceOptions & { provides: ServiceKey<any> },
    T extends ContractOf<Options['provides']>,
  >(
    create: (context: ServerServiceContext) => T,
    options: Options,
  ): ServiceDefinition<T> & Options;
  <T, const Options extends ServiceOptions & { provides?: undefined } = {}>(
    create: (context: ServerServiceContext) => T,
    options?: Options,
  ): ServiceDefinition<T> & Options;
};

/** A server interceptor around operations (`action`) or an observer of a service (`service`). */
export const defineInterceptor = defineAnyInterceptor as unknown as {
  (spec: ServerInterceptorSpec): InterceptorSpec;
  <const Name extends string, const Key extends string = string>(
    spec: ServiceInterceptorSpec<Name, Key>,
  ): InterceptorSpec;
};
