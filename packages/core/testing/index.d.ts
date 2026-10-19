import type {
  AuthService,
  EventService,
  BitaKitApp,
  BitaKitEvent,
  BitaKitRuntime,
  Plugin,
  Services,
} from '@bitakit/core';
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
  },
): Promise<MountedPlugin>;

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
