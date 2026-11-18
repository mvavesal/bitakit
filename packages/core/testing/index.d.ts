import type {
  AuthService,
  EventService,
  BitaKitApp,
  BitaKitEvent,
  BitaKitRuntime,
  Plugin,
  Remote,
  Services,
} from '@bitakit/core';
import type {
  Caller,
  RequestIdentity,
  RequestMember,
  RequestUser,
  Server,
} from '@bitakit/core/server';
import type {
  ActionId,
  ActionInput,
  ActionList,
  ActionResult,
  ExecutionResult,
} from '@bitakit/core/actions';

export type MountedPlugin = {
  id: string;
  runtime: BitaKitRuntime;
  app: BitaKitApp;
  /** The runtime's ActionList; IDs known from `ActionMap` type the input and result of `execute`. */
  actions: ActionList;
  /** Services as the plugin's contributions see them: `services.notes.list`. */
  services: Services;
  /** The runtime bus plus every event emitted while mounted. */
  events: EventService & { recorded: Pick<BitaKitEvent, 'type' | 'data'>[] };
  /**
   * Executes `<plugin>.<name>` or a full action ID. IDs known from `ActionMap` type the input and
   * the result through `ActionId` of `@bitakit/core/actions`, so no generated file is imported;
   * short names and unknown IDs stay untyped.
   */
  execute<Id extends ActionId | (string & {})>(
    name: Id,
    input?: ActionInput<Id>,
  ): Promise<ExecutionResult<ActionResult<Id>>>;
  stop(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

/**
 * Mounts one plugin folder headlessly for tests, discovered with the same conventions as apps,
 * including `events.ts` and `setup.ts`. Files under `ui/` are skipped. Resolves after every
 * `onStart`; a failing start rejects with the attributed startup error.
 */
export function mountPlugin(
  directory?: string,
  options?: {
    /** Defaults to `id` in the folder's `plugin.config.ts`, the folder under `plugins/`, or the package name. */
    id?: string;
    /**
     * Further plugins mounted alongside: `Plugin` objects (stubs such as a Shell slot owner) or
     * plugin folder paths, discovered like the tested folder.
     */
    plugins?: readonly (Plugin | string)[];
    /** Host-provided services, such as a fake authentication service. */
    services?: Readonly<Record<string, unknown>>;
    configOverrides?: Readonly<Record<string, Record<string, unknown>>>;
    /**
     * Replaces the client `remote` in Action and service contexts: a stub, or
     * `mountServer(...).as(identity(...))` so the client half calls its real server half in-process.
     */
    remote?: Remote | Caller;
  },
): Promise<MountedPlugin>;

export type MountedServer = {
  /** The mounted plugin's ID, or the app module's (`'app'` unless its `plugin.config.ts` names one). */
  id: string;
  /** The booted server handle (`operations()`, `call()`); `as()` below is the usual entry. */
  server: Server;
  /**
   * An in-process caller with this identity over every operation, also private ones, with the
   * same access checks, input validation and interceptors as over HTTP:
   * `await mounted.as(identity({ organization: 'org-1' })).todos.add({ title: 'A' })`.
   */
  as(identity: RequestIdentity): Caller;
  /**
   * Loads a server module through the loader the mounted files use, so a test seeds or inspects
   * the same instance its Actions and services see: `await mounted.import('src/server/db.ts')`.
   * Takes a path relative to the working directory (as `mountServer` takes folders), an absolute
   * path, a tsconfig `paths` alias or a package. A module imported natively (`import ... from`)
   * is a second copy.
   */
  import<Module = Record<string, any>>(specifier: string): Promise<Module>;
  stop(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

/** An integration contribution kind, as `kinds` of bitakit.config.ts declares it. */
export type TestContributionKind = {
  name: string;
  directory: string;
  /** The module exporting the normalizer; a relative path resolves against the app folder. */
  from: string;
  normalize: string;
  /** Only `server` kinds load: their files in `server/contributions/<directory>`. */
  runtime?: 'client' | 'server' | 'both';
  /** A server kind that ran in the browser before; `mountServer` reads only its server folder. */
  movedFrom?: 'client';
  types?: { entry: string; map: string };
};

/**
 * Mounts the server half of one folder for tests and boots it: the shared `events.ts`,
 * `settings.ts`, `permissions.ts` and `configs/`, plus `server/services`, `server/actions`,
 * `server/interceptors` and the files of server-only contribution kinds. The app folder
 * (`directory` of bitakit.config.ts, `src` by default) mounts as the app module, whose
 * operations are unprefixed (`whoami`, as in the generated server file); any other folder mounts
 * as a plugin. Files load through jiti with the nearest tsconfig.json's `paths`, so server files
 * may import `@/server/db` or `./helpers`; read their modules in the test through `import()`. A
 * test `requestContext` provider answers every `as()` caller with its identity; it replaces any
 * provider the mounted folders declare. A folder keeps only its `dependencies` on mounted modules,
 * as the generated server file drops package plugins (they have no server half): mount a local
 * plugin the code needs through `plugins`. Rejects with the attributed startup error, and names
 * the required `@bitakit/discovery` version when the installed one does not report `server/`
 * folders.
 */
export function mountServer(
  directory?: string,
  options?: {
    /**
     * A plugin defaults to `id` in the folder's `plugin.config.ts`, the folder under `plugins/`,
     * or the package name; the app module to its `plugin.config.ts` `id`, else `'app'`.
     */
    id?: string;
    /** Mount the folder as the app module (unprefixed) or as a plugin; detected by default. */
    app?: boolean;
    /** Further plugin folders (their server halves) or `Plugin` objects. */
    plugins?: readonly (Plugin | string)[];
    /** Host-provided services; `requestContext` is the test provider's and cannot be passed. */
    services?: Readonly<Record<string, unknown>>;
    configOverrides?: Readonly<Record<string, Record<string, unknown>>>;
    /**
     * Contribution kinds besides `kinds` of bitakit.config.ts, such as the ones a package declares
     * through its discovery hook; the same name replaces the configured kind.
     */
    kinds?: readonly TestContributionKind[];
  },
): Promise<MountedServer>;

export type TestIdentityOptions = {
  /** A user ID or user; `null` is a signed-out caller. Default `{ id: 'user-1' }`. */
  user?: string | RequestUser | null;
  /** The organization of a verified, active membership: an ID or `{ id }`. Default none. */
  organization?: string | { readonly id: string } | null;
  /** The membership record `ctx.member` receives. Default `null`. */
  member?: RequestMember | null;
  /**
   * What `can` grants, and nothing else: `{ todos: ['create'] }`, a resource's `'*'` for every
   * operation, or `'*'` for everything. Default nothing.
   */
  permissions?: '*' | Readonly<Record<string, '*' | readonly string[]>>;
  /** Why there is no organization: `'NO_ACTIVE_ORGANIZATION'` or `'NOT_A_MEMBER'`. */
  reason?: RequestIdentity['reason'];
};
/** A test identity for `mountServer(...).as()`; see `TestIdentityOptions`. */
export function identity(options?: TestIdentityOptions): RequestIdentity;

/**
 * Checks an `auth` provider against the AuthService contract, for the provider's own tests:
 * a stable snapshot, working subscribe/unsubscribe, a string `user.id` after `signIn`, an
 * awaited `signOut` that clears the user, and valid optional `paths` and `signIn`. Rejects with
 * the first broken rule.
 */
export function assertAuthContract(
  service: AuthService,
  options: {
    /** Signs a test user in through the provider's own login. Called twice. */
    signIn(): Promise<unknown>;
    /** Milliseconds to wait for a pending session or a sign-in to settle (default 2000). */
    timeout?: number;
  },
): Promise<void>;
