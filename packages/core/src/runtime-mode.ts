import type { ConfigContext } from './config-service.js';
import type { Events } from './events/types.js';
import type { RequestContext } from './request-context.js';
import type { NormalizedPlugin } from './runtime.js';
import type { ServiceRequester } from './service-names.js';
import type { Remote } from './remote.js';

/**
 * `client` (the default) registers Actions in the ActionList and follows the `auth` identity;
 * `server` is the headless mode under `createServer`: no ActionList registration, no store
 * observation, no settings activation, per-request settings `load()` and no structural updates.
 */
export type RuntimeMode = 'client' | 'server';
export type RuntimeOptions = {
  mode?: RuntimeMode;
  /** Replaces the `remote` built from `config.remote` (tests and in-process hosts). */
  remote?: Remote;
};

/** What the server kernel needs from a starting runtime. Internal to Core. */
export type ServerStartParts = {
  readonly modules: readonly NormalizedPlugin[];
  readonly appId: string;
  config(module: string, path?: readonly string[]): ConfigContext;
  events(module: string): { readonly events: Events; withContext(ctx: RequestContext): Events };
  require(module: string, ids: readonly string[] | undefined, requester: ServiceRequester): void;
  attribute(error: unknown, module: string, what: string, source?: string): Error;
};

/**
 * The kernel registers its compiler here before mounting; a server-mode runtime calls it once,
 * synchronously, where a client runtime installs its Actions. A module-scoped WeakMap keeps the
 * hook off the public runtime API.
 */
export const serverStartHooks = new WeakMap<object, (parts: ServerStartParts) => void>();
