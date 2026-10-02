import type { BetterAuthClient } from './index.js';
import type { OrganizationBackend } from '@bitakit/organizations';

/** Optional explicit demo mode. Never fall back to demo data after a real API failure. */
export function sessionOrganizationBackend(
  client: BetterAuthClient,
  authenticated: OrganizationBackend,
  signedOut: OrganizationBackend = authenticated,
): OrganizationBackend {
  const atom = client.$store.atoms.session;
  let loadedUser: string | null | undefined;
  const user = () => {
    const state = atom.get();
    if (state.isPending || state.error) throw new Error('Authentication is not ready.');
    return state.data?.user.id ?? null;
  };
  const selected = () => (atom.get().data?.user ? authenticated : signedOut);
  const backend = {
    subscribe(listener: () => void) {
      let previous = atom.get();
      return atom.subscribe((current) => {
        if (
          current.data?.user.id === previous.data?.user.id &&
          current.data?.user.emailVerified === previous.data?.user.emailVerified &&
          current.data?.session?.id === previous.data?.session?.id &&
          current.data?.session?.activeOrganizationId ===
            previous.data?.session?.activeOrganizationId &&
          current.isPending === previous.isPending &&
          current.error === previous.error
        )
          return;
        previous = current;
        listener();
      });
    },
    async load() {
      const identity = user();
      const result = await selected().load();
      if (identity !== user()) throw new Error('Account changed during loading.');
      loadedUser = identity;
      return result;
    },
  } as OrganizationBackend;
  for (const key of [
    'create',
    'setActive',
    'invite',
    'cancelInvitation',
    'updateRole',
    'removeMember',
    'update',
    'delete',
    'acceptInvitation',
    'rejectInvitation',
    'setMemberDisabled',
  ] as const) {
    Object.defineProperty(backend, key, {
      enumerable: true,
      get() {
        if (!selected()[key]) return undefined;
        return async (input: never) => {
          if (user() !== loadedUser) throw new Error('Account changed. Reload before writing.');
          const operation = selected()[key];
          if (!operation) throw new Error('Operation unavailable.');
          await (operation as (input: never) => Promise<void>)(input);
        };
      },
    });
  }
  Object.defineProperty(backend, 'customInvitationExpiry', {
    get: () => selected().customInvitationExpiry,
  });
  return backend;
}
