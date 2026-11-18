import { actionIdPattern } from '../conventions.js';
import {
  isOperationError,
  OperationError,
  operationErrorBody,
  operationStatus,
} from '../operation-error.js';
import { organizationHeader } from '../remote.js';
import type { Server } from './types.js';

export type FetchHandlerOptions = {
  /** Further exact origins (`https://admin.example.com`) allowed to call; never `*` or patterns. */
  trustedOrigins?: readonly string[];
  /** The app's public origin behind a proxy; otherwise the request URL's origin. */
  origin?: string;
  /** Largest accepted body in bytes, a whole number ≥ 0; default 1 MiB. */
  maxBodyBytes?: number;
};

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
const failure = (error: OperationError, extra: Record<string, string> = {}) =>
  reply(
    operationStatus(error.code),
    { error: operationErrorBody(error) },
    typeof error.retryAfter === 'number' && Number.isFinite(error.retryAfter)
      ? { 'retry-after': String(Math.max(0, Math.ceil(error.retryAfter))), ...extra }
      : extra,
  );
const notFound = () => failure(new OperationError('NOT_FOUND', 'Operation not found.'));

function exactOrigin(value: string, option: string, label: string): string {
  let parsed: URL | undefined;
  try {
    parsed = new URL(value);
  } catch {
    /* rejected below */
  }
  if (!parsed || value === 'null' || value.includes('*') || parsed.origin !== value)
    throw new TypeError(
      `${label}: ${option} "${value}" is not an exact origin such as https://app.example.com.`,
    );
  return value;
}

/** Reads at most `limit` bytes; undefined when the body is larger. */
async function readBody(request: Request, limit: number): Promise<Uint8Array | undefined> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** The `host[:port]` of an Origin header value, or undefined for anything that is not a URL. */
function hostOf(origin: string): string | undefined {
  try {
    return new URL(origin).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The built-in HTTP transport: `POST <server.endpoint>/<operation id>` with a JSON body, answered
 * with `{ "data": result }` or `{ "error": { code, message, issues?, reason?, requestId? } }`.
 * Only exposed operations are reachable, by their exact ID (no case folding, no decoding). Browser
 * requests must come from the app's origin or a trusted one; bodies are limited in size.
 * Invalid `trustedOrigins`, `origin` or `maxBodyBytes` throw when the handler is created.
 */
/** The headers a browser may send to an operation across origins. */
const allowedHeaders = 'content-type, authorization, x-bitakit-organization';
/**
 * Who may call from a browser, and the CORS answers for trusted origins (2026-11-18). `allowed` is
 * the Origin rule: a browser request must come from the app's origin or a trusted one; its own
 * `Sec-Fetch-Site` settles it, else the Origin must be the app's (behind a proxy the given
 * `origin`, otherwise the request URL's origin or the Host the browser sent). Requests without
 * Origin and Sec-Fetch-Site (servers, scripts) pass. Only `trustedOrigins` get CORS: `preflight`
 * answers their `OPTIONS` (204, never `*`), `headers` are added to their responses; any other
 * origin gets no CORS and stays refused. Invalid options throw when it is created.
 */
export function crossOrigin(
  options: Pick<FetchHandlerOptions, 'trustedOrigins' | 'origin'> = {},
  label = 'crossOrigin',
): {
  allowed(request: Request): boolean;
  headers(request: Request): Record<string, string> | undefined;
  preflight(request: Request, methods: string): Response | undefined;
} {
  const trusted = new Set(
    (options.trustedOrigins ?? []).map((origin) => exactOrigin(origin, 'trusted origin', label)),
  );
  const ownOrigin =
    options.origin === undefined ? undefined : exactOrigin(options.origin, 'origin', label);
  const allowed = (request: Request) => {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    return !(origin !== null
      ? // The browser's own Sec-Fetch-Site (pages cannot set it) settles it; otherwise the Origin
        // must be the app's. Hosts may hand route handlers another URL than the browser used
        // (Next.js gives `localhost` for a page at 127.0.0.1), so without an explicit `origin`
        // the Host header the browser sent counts as the app's origin too.
        site !== 'same-origin' &&
        !trusted.has(origin) &&
        (ownOrigin !== undefined
          ? origin !== ownOrigin
          : origin !== url.origin && hostOf(origin) !== request.headers.get('host'))
      : site !== null && site !== 'same-origin' && site !== 'none');
  };
  /** A trusted origin calling across origins: the one case that gets CORS headers. */
  const trustedCaller = (request: Request) => {
    const origin = request.headers.get('origin');
    return origin !== null &&
      trusted.has(origin) &&
      request.headers.get('sec-fetch-site') !== 'same-origin'
      ? origin
      : undefined;
  };
  return {
    allowed,
    headers(request) {
      const origin = trustedCaller(request);
      return origin
        ? {
            'access-control-allow-origin': origin,
            'access-control-allow-credentials': 'true',
            vary: 'Origin',
          }
        : undefined;
    },
    preflight(request, methods) {
      if (request.method !== 'OPTIONS') return undefined;
      const origin = trustedCaller(request);
      if (!origin)
        return request.headers.get('origin') === null
          ? undefined
          : new Response(null, {
              status: 403,
              headers: { vary: 'Origin', 'cache-control': 'no-store' },
            });
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': methods,
          'access-control-allow-headers': allowedHeaders,
          'access-control-max-age': '600',
          vary: 'Origin',
        },
      });
    },
  };
}

/** The Origin rule of `fetchHandler` for other transports: true when a request may call. */
export function originRule(
  options: Pick<FetchHandlerOptions, 'trustedOrigins' | 'origin'> = {},
  label = 'originRule',
): (request: Request) => boolean {
  return crossOrigin(options, label).allowed;
}

export function fetchHandler(
  server: Server,
  options: FetchHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const policy = crossOrigin(options, 'fetchHandler');
  const limit = options.maxBodyBytes ?? 1024 * 1024;
  // NaN or Infinity would silently turn the limit off (`size > NaN` is never true).
  if (!Number.isSafeInteger(limit) || limit < 0)
    throw new TypeError(
      `fetchHandler: maxBodyBytes ${String(options.maxBodyBytes)} is not a whole number of bytes (0 or more).`,
    );
  const prefix = `${server.endpoint.replace(/\/+$/, '')}/`;
  const handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(prefix)) return notFound();
    const preflight = policy.preflight(request, 'POST');
    if (preflight) return preflight;
    if (request.method !== 'POST')
      return failure(new OperationError('METHOD_NOT_SUPPORTED', 'Use POST.'), { allow: 'POST' });
    const id = url.pathname.slice(prefix.length);
    if (!actionIdPattern.test(id) || id.includes('/')) return notFound();
    if (!policy.allowed(request))
      return failure(new OperationError('FORBIDDEN', 'Cross-origin requests are not allowed.'));
    const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json')
      return failure(
        new OperationError('UNSUPPORTED_MEDIA_TYPE', 'Send JSON (content-type: application/json).'),
      );
    const tooLarge = () =>
      failure(new OperationError('PAYLOAD_TOO_LARGE', 'The request body is too large.'));
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > limit) return tooLarge();
    const bytes = await readBody(request, limit);
    if (!bytes) return tooLarge();
    let input: unknown;
    if (bytes.byteLength) {
      try {
        input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch {
        return failure(new OperationError('BAD_REQUEST', 'Invalid JSON.'));
      }
    }
    let result: unknown;
    try {
      result = await server.call(id, input, request, {
        exposedOnly: true,
        organizationId: request.headers.get(organizationHeader) ?? undefined,
      });
    } catch (error) {
      if (isOperationError(error)) return failure(error);
      const requestId = globalThis.crypto.randomUUID();
      console.error(`[bitakit] The server call failed (reference ${requestId}).`, error);
      return failure(
        new OperationError(
          'INTERNAL_SERVER_ERROR',
          `Something went wrong. Reference: ${requestId}`,
          {
            requestId,
          },
        ),
      );
    }
    try {
      return reply(200, result === undefined ? {} : { data: result });
    } catch (error) {
      const requestId = globalThis.crypto.randomUUID();
      console.error(
        `[bitakit] The result of server:${id} cannot be sent as JSON (reference ${requestId}).`,
        error,
      );
      return failure(
        new OperationError(
          'INTERNAL_SERVER_ERROR',
          `Something went wrong. Reference: ${requestId}`,
          {
            requestId,
          },
        ),
      );
    }
  };
  // A trusted origin's browser may read the answer (CORS); nobody else's gets these headers.
  return async (request) => {
    const response = await handle(request);
    const cors = policy.headers(request);
    if (cors && request.method !== 'OPTIONS')
      for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  };
}
