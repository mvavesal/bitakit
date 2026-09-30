import { getAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { organizationMetadata } from '@/lib/organizations/details';

export async function GET(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const id = (
    await getDatabase().session.findUnique({
      where: { id: session.session.id },
      select: { activeOrganizationId: true },
    })
  )?.activeOrganizationId;
  if (!id) return Response.json({ error: 'noOrganization' }, { status: 404 });
  // Verify membership and suspension before reading any people or invitations.
  const organization = await auth.api
    .getFullOrganization({ headers: request.headers, query: { organizationId: id } })
    .catch(() => null);
  if (!organization) return Response.json({ error: 'forbidden' }, { status: 403 });
  const db = getDatabase();
  const [members, invitations] = await Promise.all([
    db.member.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        role: true,
        disabled: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true, email: true, image: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.invitation.findMany({
      where: { organizationId: id, status: 'pending', expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const viewer = members.find((member) => member.userId === session.user.id);
  if (!viewer || viewer.disabled) return Response.json({ error: 'forbidden' }, { status: 403 });
  const website = organizationMetadata(organization.metadata).website;
  return Response.json(
    {
      organization: {
        id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo ?? null,
        website: typeof website === 'string' ? website : '',
        role: viewer.role,
        memberCount: members.length,
      },
      viewerMemberId: viewer.id,
      viewerRole: viewer.role,
      canInvite: viewer.role.split(',').some((role) => role === 'owner' || role === 'admin'),
      members: members.map(({ id, role, disabled, createdAt, user }) => ({
        id,
        role,
        disabled,
        createdAt: createdAt.toISOString(),
        ...user,
      })),
      invitations: invitations.map((invitation) => ({
        ...invitation,
        createdAt: invitation.createdAt.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
