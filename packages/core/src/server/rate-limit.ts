import { defineContract } from '../service-key.js';
import { OperationError } from '../operation-error.js';

/**
 * Where the counts of a rate limit live. The default keeps them in this process (one count per
 * server instance); a shared store (Redis, a database) implements the same `hit`.
 */
export type RateLimitStore = {
  /** Counts one call for `key` in the current window and answers the window's count and its end (ms). */
  hit(
    key: string,
    windowMs: number,
  ): { count: number; resetAt: number } | Promise<{ count: number; resetAt: number }>;
};

/**
 * Limits for exposed `public` operations called over HTTP (all transports): per client and
 * operation, `limit` calls per `windowMs`. Calls of signed-in callers' operations, in-process calls
 * (`server.as`, `server.system`) and private operations are never counted.
 */
export type RateLimitOptions = {
  /** Calls per window and client for one operation; default 120. */
  limit?: number;
  /** The window in milliseconds; default 60 000. */
  windowMs?: number;
  /**
   * Who the client is, from the request; default the first address of `x-forwarded-for`, then
   * `x-real-ip`, then one shared bucket. Set it to what your host verifies (its client IP).
   */
  key?(request: Request): string | undefined;
  /** Default: in this process. */
  store?: RateLimitStore;
};

/** Fixed windows in a Map; expired windows are dropped as new ones start. */
export function memoryRateLimitStore(): RateLimitStore {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let sweepAt = 0;
  return {
    hit(key, windowMs) {
      const now = Date.now();
      if (now >= sweepAt) {
        for (const [name, window] of windows) if (window.resetAt <= now) windows.delete(name);
        sweepAt = now + windowMs;
      }
      const current = windows.get(key);
      const window =
        current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
      window.count++;
      windows.set(key, window);
      return { count: window.count, resetAt: window.resetAt };
    },
  };
}

/**
 * Who the client is and where the counts live, from code: one server service provides it
 * (`provides: rateLimit`, usually `src/server/services/rate-limit.ts`), so the generated server
 * uses them too. The numbers stay in `ServerOptions.rateLimit` (`server.rateLimit` in
 * bitakit.config.ts); a `key` or `store` given there wins over the provider's.
 */
export type RateLimitProvider = {
  key?(request: Request): string | undefined;
  readonly store?: RateLimitStore;
};
export const rateLimit = defineContract('rateLimit').of<RateLimitProvider>();

const defaultKey = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip')?.trim() ||
  undefined;

/** `(operationId, request) => Promise<void>`: throws TOO_MANY_REQUESTS once the client's window is full. */
export function rateLimiter(options: RateLimitOptions = {}) {
  const limit = options.limit ?? 120;
  const windowMs = options.windowMs ?? 60_000;
  if (!Number.isInteger(limit) || limit < 1)
    throw new TypeError('rateLimit.limit is a whole number of calls (1 or more).');
  if (!Number.isFinite(windowMs) || windowMs < 1)
    throw new TypeError('rateLimit.windowMs is a duration in milliseconds.');
  const store = options.store ?? memoryRateLimitStore();
  const keyOf = options.key ?? defaultKey;
  return async (operation: string, request: Request) => {
    const client = keyOf(request) ?? 'anonymous';
    const { count, resetAt } = await store.hit(`${operation}\u0000${client}`, windowMs);
    if (count > limit)
      throw new OperationError('TOO_MANY_REQUESTS', 'Too many requests. Try again later.', {
        retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
      });
  };
}
