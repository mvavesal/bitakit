import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { getDatabase } from '../db';

// Better Auth still checks roles/membership. This adds organization-only suspension,
// including direct server API calls, existing sessions and invitation-ID routes.
export const organizationAccessHooks = {
  before: createAuthMiddleware(async (ctx) => {
    const organizationRequest = ctx.path.startsWith('/organization/');
    const apiKeyRequest = ctx.path.startsWith('/api-key/');
    if (!organizationRequest && !apiKeyRequest) return;
    const session = await getSessionFromCtx(ctx);
    if (!session) return;
    const db = getDatabase();
    const body = ctx.body ?? {};
    const query = ctx.query ?? {};
    let organizationId = body.organizationId ?? query.organizationId;
    const invitationId = body.invitationId ?? query.invitationId;
    const teamId = body.teamId ?? query.teamId;
    // Resolve persisted ownership, never trust a client-selected organization for a key.
    if (apiKeyRequest) {
      const keyId = body.keyId ?? query.id;
      if (typeof keyId === 'string') {
        const key = await db.apikey.findUnique({ where: { id: keyId } });
        organizationId = key?.configId === 'organization' ? key.referenceId : undefined;
      } else if ((body.configId ?? query.configId) !== 'organization') {
        return; // Personal keys are checked by the API-key plugin against session.user.id.
      }
      if (typeof organizationId !== 'string') return;
    }
    if (organizationRequest && typeof teamId === 'string') {
      organizationId = (await db.team.findUnique({ where: { id: teamId } }))?.organizationId;
    }
    const slug = body.organizationSlug ?? query.organizationSlug;
    if (typeof invitationId === 'string') {
      organizationId = (await db.invitation.findUnique({ where: { id: invitationId } }))
        ?.organizationId;
    } else if (
      typeof slug === 'string' &&
      (ctx.path !== '/organization/set-active' || !organizationId)
    ) {
      organizationId = (await db.organization.findUnique({ where: { slug } }))?.id;
    }
    // Unscoped operations must remain available to suspended members.
    if (
      [
        '/organization/create',
        '/organization/list',
        '/organization/check-slug',
        '/organization/list-user-invitations',
      ].includes(ctx.path)
    )
      return;
    if (ctx.path === '/organization/set-active' && body.organizationId === null) return;
    organizationId ??= session.session.activeOrganizationId;
    if (typeof organizationId !== 'string') return;
    const member = await db.member.findFirst({
      where: { organizationId, userId: session.user.id },
    });
    if (member?.disabled) {
      throw new APIError('FORBIDDEN', { message: 'Your access to this organization is disabled.' });
    }
  }),
  after: createAuthMiddleware(async (ctx) => {
    // Native team management is available to team members. Join the authorized
    // creator through Better Auth's own API, which maintains limits/counters.
    if (ctx.path === '/organization/create-team') {
      const team = ctx.context.returned as { id?: string } | undefined;
      const session = await getSessionFromCtx(ctx);
      if (team?.id && session && ctx.headers) {
        const { getAuth } = await import('../auth');
        await getAuth().api.addTeamMember({
          headers: ctx.headers,
          body: { teamId: team.id, userId: session.user.id },
        });
      }
      return;
    }
    if (
      !['/organization/list', '/organization/list-user-teams'].includes(ctx.path) ||
      !Array.isArray(ctx.context.returned)
    )
      return;
    const session = await getSessionFromCtx(ctx);
    if (!session) return;
    const suspended = await getDatabase().member.findMany({
      where: { userId: session.user.id, disabled: true },
      select: { organizationId: true },
    });
    const ids = new Set(suspended.map((member) => member.organizationId));
    return ctx.json(
      ctx.context.returned.filter(
        (entry: { id: string; organizationId?: string }) =>
          !ids.has(ctx.path === '/organization/list' ? entry.id : (entry.organizationId ?? '')),
      ),
    );
  }),
};
