import { randomUUID } from 'node:crypto';
import { getAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { organizationMetadata } from '@/lib/organizations/details';
import { organizationSchema } from '@/lib/organizations/schema';
import { assetsStorage } from '@/lib/storage/assets';
import { MAX_LOGO_BYTES, prepareLogo } from '@/lib/storage/logo';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const memberships = await getDatabase().member.findMany({
    where: { userId: session.user.id, disabled: false },
    include: { organization: { include: { _count: { select: { members: true } } } } },
  });
  return Response.json(
    memberships.map(({ role, organization }) => {
      const website = organizationMetadata(organization.metadata).website;
      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        role,
        memberCount: organization._count.members,
        website: typeof website === 'string' ? website : '',
      };
    }),
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export const POST = save;
export const PATCH = save;

async function save(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL!).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const organizationId =
    request.method === 'PATCH' ? new URL(request.url).searchParams.get('id') : null;
  if (request.method === 'PATCH' && !organizationId)
    return Response.json({ error: 'invalid' }, { status: 400 });
  let existingMetadata: Record<string, unknown> = {};
  if (organizationId) {
    try {
      const permission = await auth.api.hasPermission({
        headers: request.headers,
        body: { organizationId, permissions: { organization: ['update'] } },
      });
      if (!permission.success) return Response.json({ error: 'forbidden' }, { status: 403 });
      const existing = await getDatabase().organization.findUnique({
        where: { id: organizationId },
      });
      if (!existing) return Response.json({ error: 'notFound' }, { status: 404 });
      existingMetadata = organizationMetadata(existing.metadata);
    } catch {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  // Bound the stream as well as individual files, including chunked requests.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'createError' }, { status: 400 });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LOGO_BYTES + 64 * 1024) {
        await reader.cancel();
        return Response.json({ error: 'logoInvalid' }, { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    return Response.json({ error: 'createError' }, { status: 400 });
  }
  const parsed = organizationSchema.safeParse({
    name: form.get('name'),
    slug: form.get('slug'),
    website: form.get('website') ?? '',
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path[0]))];
    return Response.json({ error: 'validation', fields }, { status: 400 });
  }
  const { name, slug, website } = parsed.data;
  const metadata = { ...existingMetadata, website };
  const file = form.get('logo');
  let image: Buffer | undefined;
  if (file instanceof File && file.size) {
    try {
      image = await prepareLogo(file);
    } catch {
      return Response.json({ error: 'logoInvalid' }, { status: 400 });
    }
  }
  let path: string | undefined;
  let logo: string | undefined;
  if (image) {
    path = `users/${session.user.id}/organizations/${randomUUID()}.webp`;
    try {
      const storage = assetsStorage();
      const uploaded = await storage.upload(path, image, {
        contentType: 'image/webp',
        upsert: false,
      });
      if (uploaded.error) throw new Error();
      logo = storage.getPublicUrl(path).data.publicUrl;
    } catch {
      return Response.json({ error: 'logoUploadError' }, { status: 502 });
    }
  }
  try {
    if (organizationId) {
      await auth.api.updateOrganization({
        headers: request.headers,
        body: {
          organizationId,
          data: {
            name,
            slug,
            metadata,
            ...(logo ? { logo } : form.get('removeLogo') === 'true' ? { logo: '' } : {}),
          },
        },
      });
      return Response.json({ id: organizationId });
    }
    const organization = await auth.api.createOrganization({
      headers: request.headers,
      body: { name, slug, logo, metadata, keepCurrentActiveOrganization: true },
    });
    return Response.json({ id: organization.id });
  } catch {
    if (path)
      await assetsStorage()
        .remove([path])
        .catch(() => undefined);
    return Response.json(
      { error: organizationId ? 'updateError' : 'createError' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL!).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get('id');
  if (!organizationId) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    // Better Auth enforces ownership, including for an explicitly selected organization.
    await auth.api.deleteOrganization({ headers: request.headers, body: { organizationId } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'deleteError' }, { status: 403 });
  }
}
