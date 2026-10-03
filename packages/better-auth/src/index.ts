import {
  definePlugin,
  provideService,
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
export function betterAuthPlugin(
  client: BetterAuthClient,
  options: {
    paths?: AuthPaths;
    signIn?: (options?: AuthSignInOptions) => Promise<void>;
    signOut?: () => Promise<void>;
  } = {},
) {
  const sessionAtom = client.$store.atoms.session;
  if (!sessionAtom) throw new Error('Better Auth client has no session atom.');
  let previous: SessionState | undefined;
  let snapshot: AuthSnapshot;
  const auth: AuthService = {
    paths: options.paths ? configureAuthPaths(options.paths) : undefined,
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
  return definePlugin({
    id: 'better-auth',
    services: [provideService(authService, { create: () => auth })],
  });
}
