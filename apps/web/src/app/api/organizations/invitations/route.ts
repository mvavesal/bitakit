import { getAuth } from '@/lib/auth';
import { APIError } from 'better-auth/api';
import { withInvitationExpiry } from '@/lib/auth/invitation-expiry';
import { createInvitationSchema } from '@/lib/organizations/invitation-schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL!).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = createInvitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const { expiresInDays, ...invitation } = parsed.data;

  // Better Auth owns membership/role checks, persistence and expiry enforcement.
  try {
    return await withInvitationExpiry(expiresInDays, () =>
      auth.api.createInvitation({
        headers: request.headers,
        body: invitation,
        asResponse: true,
      }),
    );
  } catch (error) {
    // Access hooks may throw before Better Auth constructs a response.
    if (error instanceof APIError) {
      return Response.json(error.body, { status: error.statusCode });
    }
    throw error;
  }
}
