import type { Namespace } from './app/types.js';
import {
  isOperationErrorCode,
  OperationError,
  operationCodeOf,
  operationErrorFrom,
} from './operation-error.js';

/**
 * Every server Action as `{ input; result; exposed }`, by ID. Empty here; the generated server
 * file (`src/bitakit.gen.server.ts`) augments it. `remote` types the exposed entries, the
 * server's in-process `Caller` all of them.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServerActionMap {}
/** Server services by ID and alias; augmented by the generated server file, never `ServiceMap`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServerServiceMap {}

/** Per-call options of `remote.<plugin>.<name>(input, options)`. */
export type RemoteCallOptions = {
  signal?: AbortSignal;
  /**
   * The organization the caller's data was loaded under; overrides the `auth` snapshot. The server
   * answers CONFLICT (`ORGANIZATION_CHANGED`) when the session's organization differs. `null` or
   * `''` means "none".
   */
  organizationId?: string | null;
};
/** One function per operation; the input is optional when the operation takes none. */
export type OperationFunction<Entry, Options> = Entry extends {
  input: infer Input;
  result: infer Result;
}
  ? undefined extends Input
    ? (input?: Input, options?: Options) => Promise<Result>
    : (input: Input, options?: Options) => Promise<Result>
  : never;
type ExposedId = {
  [K in keyof ServerActionMap & string]: ServerActionMap[K] extends { exposed: true } ? K : never;
}[keyof ServerActionMap & string];
/** The exposed server operations as nested functions: `remote.todos.add(input)`. */
export type Remote = Namespace<{
  [K in ExposedId]: OperationFunction<ServerActionMap[K], RemoteCallOptions>;
}>;
/** Generated into the client config when exposed server Actions exist. */
export type RemoteConfig = { readonly endpoint: string; readonly operations: readonly string[] };

export const organizationHeader = 'x-bitakit-organization';

/**
 * Name segments no server Action ID may use. As properties of `remote` or the in-process caller
 * they would make a namespace thenable (`then`), observable (`subscribe`), or called by
 * serialization and conversion (`toJSON`, `valueOf`, `toString`), or shadow Promise and object
 * plumbing (`catch`, `finally`, `constructor`, `prototype`). The kernel refuses such IDs at
 * startup; `remote` and the caller never offer them.
 */
export const reservedSegments: ReadonlySet<string> = new Set([
  'then',
  'catch',
  'finally',
  'subscribe',
  'toJSON',
  'valueOf',
  'toString',
  'constructor',
  'prototype',
]);
/** The first reserved segment of an operation ID, if it has one. */
export const reservedSegmentOf = (id: string): string | undefined =>
  id.split('.').find((segment) => reservedSegments.has(segment));

/**
 * Builds `remote` once per runtime: nested plain, frozen functions (never a Proxy, never
 * observable), one per configured operation, each a `POST <endpoint>/<id>` with a JSON body.
 * `organization` reads the default organization header at call time (undefined: no header).
 * Without a configuration every call rejects with SERVICE_UNAVAILABLE instead of a TypeError.
 * IDs with a reserved segment (`reservedSegments`) are left out with one warning.
 */
export function createRemote(
  config: RemoteConfig | undefined,
  organization: () => string | undefined = () => undefined,
): Remote {
  if (!config) return unconfiguredRemote();
  const endpoint = config.endpoint.replace(/\/+$/, '');
  const root: Record<string, unknown> = {};
  const reserved: string[] = [];
  for (const id of new Set(config.operations)) {
    if (reservedSegmentOf(id) !== undefined) {
      reserved.push(id);
      continue;
    }
    const call = (input?: unknown, options?: RemoteCallOptions) =>
      callOperation(`${endpoint}/${id}`, input, options, organization);
    const parts = id.split('.');
    let node = root;
    parts.forEach((part, index) => {
      const existing = Object.hasOwn(node, part) ? node[part] : undefined;
      if (index === parts.length - 1) {
        // An ID that is also a prefix (`todos` and `todos.add`) keeps its children on the function.
        const leaf = existing
          ? Object.defineProperties(call, Object.getOwnPropertyDescriptors(existing))
          : call;
        Object.defineProperty(node, part, {
          value: leaf,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else {
        if (!existing)
          Object.defineProperty(node, part, {
            value: {},
            enumerable: true,
            writable: true,
            configurable: true,
          });
        node = node[part] as Record<string, unknown>;
      }
    });
  }
  if (reserved.length)
    console.warn(
      `[bitakit] remote leaves out ${reserved.map((id) => `"${id}"`).join(', ')}: ${[...reservedSegments].join(', ')} are reserved names and cannot be server Action names.`,
    );
  return deepFreeze(root) as Remote;
}

function deepFreeze(value: object): object {
  for (const child of Object.values(value)) if (child && !Object.isFrozen(child)) deepFreeze(child);
  return Object.freeze(value);
}

async function callOperation(
  url: string,
  input: unknown,
  options: RemoteCallOptions | undefined,
  organization: () => string | undefined,
): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const expected =
    options?.organizationId !== undefined ? (options.organizationId ?? '') : organization();
  if (expected !== undefined) headers[organizationHeader] = expected;
  const signal = options?.signal;
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: input === undefined ? undefined : JSON.stringify(input),
      signal,
    });
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    throw new OperationError('SERVICE_UNAVAILABLE', 'The server could not be reached.', {
      cause: error,
    });
  }
  return envelope(response, text);
}

const unexpected = 'The server sent an unexpected answer.';
/**
 * Reads the RPC envelope. Only a 2xx `{ "data": ... }` (or `{}`: no result) resolves, and
 * `{ "error": {...} }` rejects with the rebuilt OperationError (an unknown code takes the HTTP
 * status's). Anything else is never a success, whatever its status: a proxy's or middleware's
 * own answer (`429 { "message": ... }`), a 2xx body without `data`, a non-JSON page. It rejects
 * with the code of the HTTP status (429 → TOO_MANY_REQUESTS, 503 → SERVICE_UNAVAILABLE, a 2xx
 * or unknown status → INTERNAL_SERVER_ERROR) and a fixed message.
 */
function envelope(response: Response, text: string): unknown {
  const fallback = response.ok ? 'INTERNAL_SERVER_ERROR' : operationCodeOf(response.status);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new OperationError(fallback, unexpected, { cause: error });
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const { error } = body as { error?: unknown };
    if (error && typeof error === 'object' && !Array.isArray(error)) {
      const { code } = error as { code?: unknown };
      throw operationErrorFrom(isOperationErrorCode(code) ? error : { ...error, code: fallback });
    }
    if (response.ok && !Object.hasOwn(body, 'error')) {
      if (Object.hasOwn(body, 'data')) return (body as { data: unknown }).data;
      if (Object.keys(body).length === 0) return undefined;
    }
  }
  throw new OperationError(fallback, unexpected);
}

/**
 * Without a configured endpoint, any operation name rejects with SERVICE_UNAVAILABLE. This is the
 * one place `remote` is a Proxy: names are unknown, so a plain object would throw a TypeError.
 * Reserved segments read as undefined at every depth, exactly as on a configured `remote`, where
 * no operation can have them: it is never thenable, never observable and never called by
 * serialization or conversion.
 */
function unconfiguredRemote(): Remote {
  const fail = () =>
    Promise.reject(
      new OperationError('SERVICE_UNAVAILABLE', 'No server operations are configured.'),
    );
  const node = (): object =>
    new Proxy(fail, {
      get: (_target, name) =>
        typeof name !== 'string' || reservedSegments.has(name) ? undefined : node(),
      apply: () => fail(),
      set: () => false,
      defineProperty: () => false,
      deleteProperty: () => false,
    });
  return node() as Remote;
}
