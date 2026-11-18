import type { Namespace } from '../app/types.js';
import type { ConfigContext } from '../config-service.js';
import type {
  ActionSpec,
  BitaKitRuntimeConfig,
  InputSchema,
  Plugin,
  ServiceContext,
} from '../definitions.js';
import type { DiscoveredFile } from '../discovered.js';
import type { Events } from '../events/types.js';
import type { InterceptorTarget } from '../interceptors/define.js';
import type {
  OperationFunction,
  RemoteCallOptions,
  ServerActionMap,
  ServerServiceMap,
} from '../remote.js';
import type { Access, ContextFor, RequestContext } from '../request-context.js';
import type { ServerSettingsAccess } from '../settings/server.js';

/** Server services as server contexts see them; never the client `ServiceMap`. */
export type ServerServices = Namespace<ServerServiceMap>;

/** What a server Action's `execute` receives. `ctx` follows the Action's `access`. */
export type ServerExecuteContext<Input = unknown, A = Access> = {
  readonly id: string;
  /** Validated by the `input` schema; `undefined` for an Action without one. */
  readonly input: Input;
  readonly ctx: ContextFor<A>;
  readonly services: ServerServices;
  readonly config: ConfigContext;
  /** The plugin's events; listeners receive this call's `ctx`. */
  readonly events: Events;
  /** Setting handles; `load()` uses this call's `ctx`. */
  readonly settings: ServerSettingsAccess;
  readonly signal: AbortSignal;
};

/** Fields of a client Action (the button) that a server Action (the operation) never has. */
export type ClientOnlyActionField =
  | 'enabled'
  | 'visible'
  | 'href'
  | 'dialog'
  | 'dialogSize'
  | 'confirm'
  | 'slots'
  | 'groups'
  | 'order'
  | 'dividerBefore'
  | 'shortcut'
  | 'icon'
  | 'tooltip'
  | 'variant'
  | 'checked'
  | 'value'
  | 'concurrency'
  | 'concurrencyKey'
  | 'success'
  | 'failure'
  | 'internal';

export type ServerActionSpecInput<Input, Result, A extends Access> = {
  /** Manual composition only; discovery derives `<plugin>.<file>`. */
  id?: string;
  title?: string;
  description?: string;
  /** Required: `public`, `user`, `organization` or `{ permission: { resource: ['operation'] } }`. */
  access: A;
  /** `true` publishes the operation over HTTP and in `remote`; otherwise it is in-process only. */
  expose?: boolean;
  /**
   * `query` reads only, so transports that support it may answer it with GET; `mutation` (the
   * default) changes something. The built-in `fetchHandler` takes POST for both.
   */
  type?: OperationType;
  /** Validates and types the input. Without it the input must be `undefined`. */
  input?: InputSchema<Input>;
  /**
   * Validates the result; the caller receives the validator's value. Whether extra keys are
   * stripped depends on the validator (zod/valibot objects strip; passthrough, ArkType and
   * TypeBox keep them).
   */
  output?: InputSchema<unknown>;
  /** Services from other plugins this operation uses; an explicit startup check. */
  requires?: readonly string[];
  execute(context: ServerExecuteContext<Input, A>): Result | Promise<Result>;
  /** Opaque host metadata; Core never interprets it. */
  metadata?: unknown;
} & { readonly [K in ClientOnlyActionField]?: never };

declare const serverSignature: unique symbol;
/**
 * A defined server Action. It is an ordinary `defineAction` result (`kind: 'action'`), so plugins
 * hold it like any Action; the phantom member carries its input, result and access for
 * `ServerActionEntry`.
 */
export type ServerActionSpec<Input = unknown, Result = unknown, A extends Access = Access> = {
  readonly kind: 'action';
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly access: A;
  readonly expose?: boolean;
  readonly type?: OperationType;
  readonly input?: InputSchema<Input>;
  readonly output?: InputSchema<unknown>;
  readonly requires?: readonly string[];
  readonly metadata?: unknown;
  execute(context: any): unknown;
  readonly [serverSignature]?: {
    readonly input: Input;
    readonly result: Result;
    readonly access: A;
  };
};

type ValueAt<T, Key extends string> = Key extends ''
  ? T
  : Key extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? ValueAt<T[Head], Rest>
      : never
    : Key extends keyof T
      ? T[Key]
      : never;
type SignatureOf<T> = T extends { readonly [serverSignature]?: infer S }
  ? NonNullable<S> extends { input: infer Input; result: infer Result }
    ? { input: Input; result: Result }
    : { input: unknown; result: unknown }
  : T extends ActionSpec<infer Input, infer Result>
    ? { input: Input; result: Awaited<Result> }
    : { input: unknown; result: unknown };
/**
 * One `ServerActionMap` entry, written by the generated server file under the Action's ID:
 * `'todos.add': ServerActionEntry<typeof file3, 'todos', true>`. `F` is the discovered file (or
 * the Action's type); `Key` selects one entry of a record file (`'add'` in `server/actions.ts`).
 * `Module` names the owner for readers of the generated file; the map key carries the ID.
 */
export type ServerActionEntry<
  F,
  _Module extends string = string,
  Exposed extends boolean = boolean,
  Key extends string = '',
> = SignatureOf<ValueAt<F extends DiscoveredFile<infer T, any> ? T : F, Key>> & {
  exposed: Exposed;
};

/** Per-call options of the in-process `Caller` and `server.call`. */
export type CallOptions = RemoteCallOptions & {
  /** Correlates the call with logs; `crypto.randomUUID()` when absent. */
  requestId?: string;
};
/** Every server operation, also private ones, as nested functions: `caller.todos.add(input)`. */
export type Caller = Namespace<{
  [K in keyof ServerActionMap & string]: OperationFunction<ServerActionMap[K], CallOptions>;
}>;
/** Whether an operation only reads (`query`) or changes something (`mutation`, the default). */
export type OperationType = 'query' | 'mutation';
/** A JSON Schema (draft 2020-12), as a transport adapter or an OpenAPI document uses it. */
export type JsonSchema = Readonly<Record<string, unknown>>;
/**
 * One compiled operation, as `server.operations()` lists it. `input` and `output` are JSON Schemas
 * when the schema can say so (Standard JSON Schema, e.g. zod 4); absent means "any".
 */
export type OperationInfo = Readonly<{
  id: string;
  plugin: string;
  access: Access;
  exposed: boolean;
  type: OperationType;
  input?: JsonSchema;
  output?: JsonSchema;
  title?: string;
  description?: string;
  source?: string;
}>;

/** Server services' context: the client keys, with server services and per-request settings. */
export type ServerServiceContext = Omit<ServiceContext, 'services' | 'settings' | 'remote'> & {
  services: ServerServices;
  /** Per-request setting handles: `await settings.todos.limit.load(ctx)`. */
  settings: ServerSettingsAccess;
};

/** What a server interceptor sees: the validated input and the call's `ctx`. */
export type ServerInterceptorContext = {
  readonly id: string;
  readonly input: unknown;
  readonly ctx: RequestContext;
  readonly services: ServerServices;
  readonly config: ConfigContext;
  readonly signal: AbortSignal;
};
/**
 * An interceptor around server operations. `before` runs after access and input validation;
 * a throw rejects the call (an OperationError passes through) and returning `false` rejects it
 * with FORBIDDEN (`INTERCEPTED`). `after` and `onError` observe and are not awaited.
 */
export type ServerInterceptorSpec = {
  readonly kind?: 'interceptor';
  /** Exact IDs, `todos.*`, or `*` (the default). */
  action?: InterceptorTarget;
  service?: never;
  method?: never;
  order?: number;
  /** `plugin` (default for plugins) sees its own operations; `global` (default for the app) sees all. */
  scope?: 'plugin' | 'global';
  requires?: readonly string[];
  before?(context: ServerInterceptorContext): void | false | Promise<void | false>;
  after?(context: ServerInterceptorContext & { readonly result: unknown }): void | Promise<void>;
  onError?(context: ServerInterceptorContext & { readonly error: unknown }): void | Promise<void>;
};

/** The composition a server runs: the client configuration without UI-only fields. */
export type ServerConfig = Omit<
  BitaKitRuntimeConfig,
  'ui' | 'slots' | 'choose' | 'groups' | 'actionOverrides' | 'remote'
>;
export type ServerOptions = {
  /** Host-provided services, as in `createRuntime`. */
  services?: Readonly<Record<string, unknown>>;
  /** Extra host plugins, for example installers for server contribution kinds. */
  plugins?: readonly Plugin[];
  /** The HTTP prefix `fetchHandler` serves; default `/api/rpc`. */
  endpoint?: string;
  /** Process-wide registration name; the generated server file passes `'bitakit'`. */
  instance?: string;
  /** Content hash of the generated server file; a different stamp replaces the kernel in development. */
  stamp?: string;
  /**
   * The exposed operation IDs the client's `remote` knows (read statically by discovery). When
   * given, an exposed operation missing from it logs one warning at boot.
   */
  operations?: readonly string[];
};
/** In-process and HTTP entry to the server kernel. Importing it never boots anything. */
export interface Server {
  readonly endpoint: string;
  /** The first access boots the kernel; resolves when every service's `onStart` finished. */
  readonly ready: Promise<void>;
  /**
   * An in-process caller with the identity the `requestContext` provider resolves for this
   * request; `Headers` are wrapped in `new Request('http://bitakit.internal/', { headers })`.
   * Every operation is callable, also private ones, with the same checks as over HTTP.
   */
  as(request: Request | Headers): Caller;
  /**
   * One call by ID. `exposedOnly` (default true, always over HTTP) admits only exposed operations
   * by their exact ID; `false` also reaches private ones and folds case like Core.
   */
  call(
    id: string,
    input: unknown,
    request: Request | Headers,
    options?: CallOptions & { exposedOnly?: boolean },
  ): Promise<unknown>;
  /** The compiled operations (boots first); SERVICE_UNAVAILABLE once stopped, never a new boot. */
  operations(): Promise<readonly OperationInfo[]>;
  /**
   * Drains in-flight calls, then stops the services. Later calls answer SERVICE_UNAVAILABLE. With
   * `instance` it stops the instance's kernel for every handle, unless a newer module copy's
   * kernel has replaced this handle's code (then only this handle stops).
   */
  stop(): Promise<void>;
}
