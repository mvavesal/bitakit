import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth, seedPreview } from '../../../server/auth';

type Task = { id: string; title: string; completed: boolean };
const tasks = new Map<string, Task[]>();
const input = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('add'), title: z.string().trim().min(1) }),
  z.object({ operation: z.literal('edit'), id: z.string(), title: z.string().trim().min(1) }),
  z.object({ operation: z.literal('complete'), id: z.string(), completed: z.boolean() }),
  z.object({ operation: z.literal('remove'), id: z.string() }),
  z.object({ operation: z.literal('clear'), organizationId: z.string() }),
]);

async function organizationFor(request: Request) {
  await seedPreview();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Response('Sign in to access tasks.', { status: 401 });
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) throw new Response('Select an organization to view its tasks.', { status: 409 });
  const member = await auth.api.getActiveMember({ headers: request.headers }).catch(() => null);
  if (!member || member.organizationId !== organizationId || (member as { disabled?: boolean }).disabled)
    throw new Response('Organization access denied.', { status: 403 });
  return organizationId;
}

export async function GET(request: Request) {
  try {
    const organizationId = await organizationFor(request);
    return Response.json({ items: tasks.get(organizationId) ?? [] });
  } catch (error) { if (error instanceof Response) return error; throw error; }
}

export async function POST(request: Request) {
  try {
    const organizationId = await organizationFor(request);
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response('Invalid task input.', { status: 400 });
    const change = parsed.data;
    if (change.operation === 'clear') {
      if (change.organizationId !== organizationId)
        return new Response('The selected organization changed. Try again.', { status: 409 });
      tasks.set(organizationId, []);
      return Response.json({ items: [] });
    }
    const items = tasks.get(organizationId) ?? [];
    if (change.operation === 'add') items.push({ id: randomUUID(), title: change.title, completed: false });
    else {
      const item = items.find((entry) => entry.id === change.id);
      if (!item) return new Response('Task not found in this organization.', { status: 404 });
      if (change.operation === 'edit') item.title = change.title;
      if (change.operation === 'complete') item.completed = change.completed;
      if (change.operation === 'remove') items.splice(items.indexOf(item), 1);
    }
    tasks.set(organizationId, items);
    return Response.json({ items });
  } catch (error) { if (error instanceof Response) return error; throw error; }
}
