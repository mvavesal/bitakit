import {
  definePlugin,
  defineService,
  getService,
  serviceKey,
  authService,
  type AuthService,
  type AuthSnapshot,
  configureAuthPaths,
  type AuthPaths,
  type AuthSignInOptions,
} from '@bitakit/core';

type SessionState = {
  data: {
    user: { id: string; name?: string; email?: string; emailVerified?: boolean };
    session?: { id?: string; activeOrganizationId?: string | null };
  } | null;
  isPending: boolean;
  error: unknown;
};
/** Structural client contract: preserves the host's Better Auth plugins and configuration. */
export type BetterAuthClient = {
  $store: {
    atoms: Record<
      string,
      {
        get(): SessionState;
        subscribe(listener: (value: SessionState) => void): () => void;
      }
    >;
  };
  signOut(): Promise<{ error: unknown }>;
};
/**
 * The host's Better Auth client, wrapped: a Better Auth client answers every property,
 * `subscribe` included, so the runtime would observe a bare client as a service.
 */
export type BetterAuthClientService = { readonly client: BetterAuthClient };
/**
 * Provide it once, for example in `src/services/better-auth-client.ts`:
 * `export default defineService(() => ({ client: authClient }), { provides: betterAuthClient })`.
 * The name is not `auth.client`: `auth` is already the authentication service itself.
 */
export const betterAuthClient = serviceKey<BetterAuthClientService, 'better-auth-client'>(
  'better-auth-client',
);
/** Options from `configs/better-auth.ts` (package manifest `configuration: 'better-auth'`). */
export type BetterAuthOptions = {
  paths?: AuthPaths;
  /** Optional SDK-native login flow; UI otherwise navigates to `paths.signIn`. */
  signIn?: (options?: AuthSignInOptions) => Promise<void>;
  /** Replaces the client's `signOut()`, for example to clear host state first. */
  signOut?: () => Promise<void>;
};

/** The `auth` contract on the session atom of the provided Better Auth client. */
function sessionAuth(
  client: BetterAuthClient,
  options: BetterAuthOptions,
  paths: AuthPaths | undefined,
): AuthService {
  const sessionAtom = client.$store.atoms.session;
  if (!sessionAtom) throw new Error('Better Auth client has no session atom.');
  let previous: SessionState | undefined;
  let snapshot: AuthSnapshot;
  return {
    paths,
    signIn: options.signIn,
    getSnapshot() {
      const session = sessionAtom.get();
      if (session !== previous) {
        previous = session;
        // The active organization scopes organization settings; only the organization plugin sets it.
        const active = (
          session.data?.session as { activeOrganizationId?: string | null } | undefined
        )?.activeOrganizationId;
        snapshot = {
          user: session.data?.user ?? null,
          organizationId: active ?? null,
          pending: session.isPending,
          error: session.error,
        };
      }
      return snapshot;
    },
    subscribe(listener) {
      return sessionAtom.subscribe(listener);
    },
    async signOut() {
      if (options.signOut) return options.signOut();
      const result = await client.signOut();
      if (result.error) throw result.error;
    },
  };
}

/**
 * Better Auth as the `auth` service. The client arrives through the `betterAuthClient`
 * contract; the options come from `configs/better-auth.ts`. Paths are validated here, so an
 * invalid path fails when the configuration is created.
 */
export function betterAuthPlugin(options: BetterAuthOptions = {}) {
  const paths = options.paths ? configureAuthPaths(options.paths) : undefined;
  return definePlugin({
    id: 'better-auth',
    metadata: {
      name: 'Better Auth',
      description: 'The authentication service on the Better Auth client session.',
    },
    services: {
      session: defineService(
        ({ services }) =>
          sessionAuth(getService(services, betterAuthClient).client, options, paths),
        { requires: [betterAuthClient], provides: authService },
      ),
    },
  });
}
