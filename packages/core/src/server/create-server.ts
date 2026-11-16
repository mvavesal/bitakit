import { OperationError } from '../operation-error.js';
import { reservedSegments } from '../remote.js';
import { Kernel, type CallerState } from './kernel.js';
import type { CallOptions, Caller, Server, ServerConfig, ServerOptions } from './types.js';

type Entry = {
  readonly stamp: string | undefined;
  readonly sequence: number;
  readonly kernel: Kernel;
};
const registryKey = Symbol.for('bitakit.servers');
const sequenceKey = Symbol.for('bitakit.servers.sequence');
type Global = typeof globalThis & {
  [registryKey]?: Record<string, Entry>;
  [sequenceKey]?: number;
};

/**
 * Kernels by instance name, shared by every module copy in this process. A stopped kernel stays
 * registered, so every handle of the instance answers SERVICE_UNAVAILABLE instead of booting a
 * second kernel nobody stops; only a newer module copy replaces it in development.
 */
function registry(): Record<string, Entry> {
  return ((globalThis as Global)[registryKey] ??= Object.create(null) as Record<string, Entry>);
}
function nextSequence(): number {
  const global = globalThis as Global;
  return (global[sequenceKey] = (global[sequenceKey] ?? 0) + 1);
}
function production(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.NODE_ENV === 'production';
}

/** `Headers` become a request with a fixed internal URL; a `Request` is used as it is. */
export function toRequest(request: Request | Headers): Request {
  if (
    typeof (request as Request).url === 'string' &&
    typeof (request as Request).clone === 'function'
  )
    return request as Request;
  return new Request('http://bitakit.internal/', { headers: request as Headers });
}

/**
 * The in-process caller: `caller.todos.add(input)` calls `todos.add`. Names are resolved per
 * call against the live kernel (exact first, then ignoring case), so it works before boot and
 * across development swaps. Reserved segments read as undefined, as on `remote`: never thenable,
 * never observable (it can stand in for `remote` in client tests).
 */
function createCaller(
  invoke: (id: string, input: unknown, options: CallOptions | undefined) => Promise<unknown>,
): Caller {
  const nodes = new Map<string, object>();
  const node = (path: string): object => {
    let proxy = nodes.get(path);
    if (proxy) return proxy;
    proxy = new Proxy(() => {}, {
      get: (_target, name) =>
        typeof name !== 'string' || reservedSegments.has(name)
          ? undefined
          : node(path ? `${path}.${name}` : name),
      apply: (_target, _this, args: unknown[]) =>
        path
          ? invoke(path, args[0], args[1] as CallOptions | undefined)
          : Promise.reject(new OperationError('NOT_FOUND', 'Operation not found.')),
    });
    nodes.set(path, proxy);
    return proxy;
  };
  return node('') as Caller;
}

/**
 * Creates the server handle. It never boots at import: the first `ready`, `as()`, `call()` or
 * `operations()` does. With `instance`, live kernels are shared process-wide under
 * `globalThis[Symbol.for('bitakit.servers')][instance]`: the same `stamp` reuses the live kernel;
 * in development a newer module copy with a different stamp boots a replacement, swaps it in
 * and stops the old one after it drains (older handles forward to the current kernel); in
 * production the first kernel wins and a different stamp logs one warning. `stop()` stops the
 * instance's kernel unless a newer module copy's kernel has replaced this handle's code; the
 * stopped kernel stays registered, so the instance's other handles answer SERVICE_UNAVAILABLE
 * rather than boot again. Without `instance` the handle owns its kernel.
 */
export function createServer(config: ServerConfig, options: ServerOptions = {}): Server {
  const endpoint = `/${(options.endpoint ?? '/api/rpc').replace(/^\/+|\/+$/g, '')}`;
  const sequence = nextSequence();
  const { instance, stamp } = options;
  let own: Kernel | undefined;
  let stopped = false;
  let stopping: Promise<void> | undefined;
  let warned = false;
  const kernel = (): Kernel => {
    if (instance === undefined) return (own ??= new Kernel(config, options));
    const live = registry()[instance];
    if (!live || (live.stamp !== stamp && !production() && sequence > live.sequence)) {
      const next = new Kernel(config, options);
      registry()[instance] = { stamp, sequence, kernel: next };
      if (live)
        void live.kernel
          .stop()
          .catch((error) =>
            console.error(`[bitakit] Stopping the replaced server "${instance}" failed.`, error),
          );
      return next;
    }
    if (live.stamp !== stamp && production() && !warned) {
      warned = true;
      console.warn(
        `[bitakit] Server "${instance}" is already running with different code; the first one stays in production.`,
      );
    }
    return live.kernel;
  };
  const invoke = (
    id: string,
    input: unknown,
    caller: CallerState,
    callOptions: CallOptions & { exposedOnly: boolean },
  ) => {
    if (stopped) {
      const requestId = callOptions.requestId ?? globalThis.crypto.randomUUID();
      return Promise.reject(
        new OperationError(
          'SERVICE_UNAVAILABLE',
          `The server is not available. Reference: ${requestId}`,
          { requestId },
        ),
      );
    }
    return kernel().call(id, input, caller, callOptions);
  };
  /** The kernel `stop()` may stop: the handle's own, or the instance's unless newer code replaced it. */
  const owned = (): Kernel | undefined => {
    if (instance === undefined) return own;
    const live = registry()[instance];
    return live && (live.stamp === stamp || live.sequence <= sequence) ? live.kernel : undefined;
  };
  return Object.freeze({
    endpoint,
    get ready() {
      return stopped ? Promise.resolve() : kernel().ready;
    },
    as(request: Request | Headers): Caller {
      const caller: CallerState = { request: toRequest(request) };
      return createCaller((id, input, callOptions) =>
        invoke(id, input, caller, { ...callOptions, exposedOnly: false }),
      );
    },
    call(
      id: string,
      input: unknown,
      request: Request | Headers,
      callOptions: CallOptions & { exposedOnly?: boolean } = {},
    ) {
      return invoke(
        id,
        input,
        { request: toRequest(request) },
        {
          ...callOptions,
          exposedOnly: callOptions.exposedOnly ?? true,
        },
      );
    },
    operations: () =>
      stopped
        ? Promise.reject(new OperationError('SERVICE_UNAVAILABLE', 'The server is not available.'))
        : kernel().list(),
    stop() {
      return (stopping ??= (async () => {
        stopped = true;
        await owned()?.stop();
      })());
    },
  } satisfies Server);
}
