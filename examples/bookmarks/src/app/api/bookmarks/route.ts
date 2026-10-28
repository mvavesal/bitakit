import type { Bookmark } from '@/plugins/bookmarks/services/list';
import { database } from '@/server/database';

// The server owns the data: it validates every request and reads or writes SQLite. The
// bookmarks plugin's service calls these handlers; its Actions show their error texts.

export function GET() {
  const bookmarks = database()
    .prepare('SELECT id, title, url FROM bookmarks ORDER BY created_at DESC, id DESC')
    .all() as Bookmark[];
  return Response.json({ bookmarks });
}

export async function POST(request: Request) {
  // The Action's enabled rule is a convenience for the UI; the server checks again.
  const { url } = (await request.json().catch(() => ({}))) as { url?: unknown };
  if (typeof url !== 'string' || !URL.canParse(url))
    return new Response('Send a full URL such as https://example.com.', { status: 400 });
  const address = new URL(url);
  const db = database();
  if (db.prepare('SELECT 1 FROM bookmarks WHERE url = ?').get(address.href))
    return new Response('This link is already saved.', { status: 409 });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO bookmarks (title, url) VALUES (?, ?)')
    .run(address.hostname, address.href);
  const bookmark: Bookmark = {
    id: Number(lastInsertRowid),
    title: address.hostname,
    url: address.href,
  };
  return Response.json({ bookmark }, { status: 201 });
}

export function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  const { changes } = database().prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (changes === 0) return new Response('This bookmark no longer exists.', { status: 404 });
  return new Response(null, { status: 204 });
}
