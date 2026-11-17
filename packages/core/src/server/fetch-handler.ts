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
const failure = (error: OperationError, extra?: Record<string, string>) =>
  reply(operationStatus(error.code), { error: operationErrorBody(error) }, extra);
const notFound = () => failure(new OperationError('NOT_FOUND', 'Operation not found.'));

function exactOrigin(value: string, option: string): string {
  let parsed: URL | undefined;
  try {
    parsed = new URL(value);
  } catch {
    /* rejected below */
  }
  if (!parsed || value === 'null' || value.includes('*') || parsed.origin !== value)
    throw new TypeError(
      `fetchHandler: ${option} "${value}" is not an exact origin such as https://app.example.com.`,
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
export function fetchHandler(
  server: Server,
  options: FetchHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const trusted = new Set(
    (options.trustedOrigins ?? []).map((origin) => exactOrigin(origin, 'trusted origin')),
  );
  const ownOrigin =
    options.origin === undefined ? undefined : exactOrigin(options.origin, 'origin');
  const limit = options.maxBodyBytes ?? 1024 * 1024;
  // NaN or Infinity would silently turn the limit off (`size > NaN` is never true).
  if (!Number.isSafeInteger(limit) || limit < 0)
    throw new TypeError(
      `fetchHandler: maxBodyBytes ${String(options.maxBodyBytes)} is not a whole number of bytes (0 or more).`,
    );
  const prefix = `${server.endpoint.replace(/\/+$/, '')}/`;
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(prefix)) return notFound();
    if (request.method !== 'POST')
      return failure(new OperationError('METHOD_NOT_SUPPORTED', 'Use POST.'), { allow: 'POST' });
    const id = url.pathname.slice(prefix.length);
    if (!actionIdPattern.test(id) || id.includes('/')) return notFound();
    const origin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    if (
      origin !== null
        ? // The browser's own Sec-Fetch-Site (pages cannot set it) settles it; otherwise the Origin
          // must be the app's. Hosts may hand route handlers another URL than the browser used
          // (Next.js gives `localhost` for a page at 127.0.0.1), so without an explicit `origin`
          // the Host header the browser sent counts as the app's origin too.
          site !== 'same-origin' &&
          !trusted.has(origin) &&
          (ownOrigin !== undefined
            ? origin !== ownOrigin
            : origin !== url.origin && hostOf(origin) !== request.headers.get('host'))
        : site !== null && site !== 'same-origin' && site !== 'none'
    )
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
}
