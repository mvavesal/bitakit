import type { RequestContextProvider } from '@bitakit/core/server';

/**
 * The two Better Auth server calls the request context makes. Structural, so the app passes its
 * `auth` and tests pass a stub.
 */
export type SessionApi = {
  api: {
    getSession(input: { headers: Headers }): Promise<{
      user: { id: string; name?: string | null; email?: string | null };
      session: { activeOrganizationId?: string | null };
    } | null>;
    getActiveMember(input: { headers: Headers }): Promise<{
      id: string;
      organizationId: string;
      userId: string;
      role: string;
      disabled?: boolean | null;
    } | null>;
  };
};

/**
 * Who calls a server operation, from the Better Auth session of the request: the signed-in user,
 * and the active organization only while that user is an enabled member of exactly that
 * organization. An active organization ID alone never grants access; a membership that cannot be
 * read is no membership.
 */
export function createRequestContext(auth: SessionApi): RequestContextProvider {
  return {
    async resolve({ headers }) {
      const session = await auth.api.getSession({ headers });
      if (!session) return { user: null };
      const { id, name, email } = session.user;
      const user = { id, name: name ?? undefined, email: email ?? undefined };
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) return { user, organization: null, reason: 'NO_ACTIVE_ORGANIZATION' };
      const member = await auth.api.getActiveMember({ headers }).catch(() => null);
      if (
        !member ||
        member.organizationId !== organizationId ||
        member.userId !== id ||
        member.disabled
      )
        return { user, organization: null, reason: 'NOT_A_MEMBER' };
      return {
        user,
        organization: { id: organizationId },
        member: { id: member.id, role: member.role },
      };
    },
  };
}
