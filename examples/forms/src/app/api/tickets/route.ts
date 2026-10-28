import { ticketSchema } from '@/plugins/tickets/schema';
import type { Ticket } from '@/plugins/tickets/services/list';
import { database } from '@/server/database';

const select = `SELECT id, title, email, priority, description, status, created_at AS createdAt
  FROM tickets`;

export function GET() {
  const tickets = database()
    .prepare(`${select} ORDER BY status, created_at DESC, id DESC`)
    .all() as Ticket[];
  return Response.json({ tickets });
}

// The same schema as the form: the browser's checks are a convenience, this one decides.
export async function POST(request: Request) {
  const parsed = ticketSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return new Response(parsed.error.issues[0].message, { status: 400 });
  const { title, email, priority, description } = parsed.data;
  const db = database();
  const { lastInsertRowid } = db
    .prepare('INSERT INTO tickets (title, email, priority, description) VALUES (?, ?, ?, ?)')
    .run(title, email, priority, description);
  const ticket = db.prepare(`${select} WHERE id = ?`).get(lastInsertRowid) as Ticket;
  return Response.json({ ticket }, { status: 201 });
}

// Closes a ticket: { id }.
export async function PATCH(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: unknown };
  const db = database();
  const { changes } = db
    .prepare("UPDATE tickets SET status = 'closed' WHERE id = ? AND status = 'open'")
    .run(Number(id));
  if (changes === 0) return new Response('This ticket is already closed.', { status: 409 });
  return Response.json({ ticket: db.prepare(`${select} WHERE id = ?`).get(Number(id)) as Ticket });
}
