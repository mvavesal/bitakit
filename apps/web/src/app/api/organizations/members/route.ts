import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

const schema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
  disabled: z.boolean(),
});

export async function PATCH(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL!).origin)
    return Response.json({ error: 'forbidden' }, { status: 403 });
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const { organizationId, memberId, disabled } = parsed.data;
  try {
    const permission = await auth.api.hasPermission({
      headers: request.headers,
      body: { organizationId, permissions: { member: ['update'] } },
    });
    if (!permission.success) return Response.json({ error: 'forbidden' }, { status: 403 });
    const db = getDatabase();
    // Owners cannot be suspended, and nobody may suspend their own membership.
    // The transaction rechecks both memberships before writing.
    await db.$transaction(async (tx) => {
      const actor = await tx.member.findFirst({
        where: { organizationId, userId: session.user.id },
      });
      const target = await tx.member.findFirst({ where: { organizationId, id: memberId } });
      if (
        !actor ||
        actor.disabled ||
        !actor.role.split(',').some((role) => role === 'owner' || role === 'admin') ||
        !target ||
        target.userId === session.user.id ||
        target.role.split(',').includes('owner')
      )
        throw new Error('forbidden');
      await tx.member.update({ where: { id: memberId }, data: { disabled } });
      if (disabled)
        await tx.session.updateMany({
          where: { userId: target.userId, activeOrganizationId: organizationId },
          data: { activeOrganizationId: null },
        });
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
}
