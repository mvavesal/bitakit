import { parseSetting, type SettingSpec } from '@bitakit/core';
import profile from '@/plugins/profile/settings';
import { database } from '@/server/database';

/**
 * Settings saved on the server. The browser only sends a key and a value; this route decides
 * whose value it is and whether it is valid, by reading the trusted declarations in
 * src/plugins/profile/settings.ts. A client cannot store a key that is not declared there.
 */
const declarations = new Map<string, SettingSpec<unknown>>(
  Object.entries(profile.settings).map(([name, spec]) => [`profile.${name}`, spec]),
);

// This example has no sign-in, so every visitor is the same owner. With authentication, read
// the session here and use the signed-in user's id.
const owner = 'user:anonymous';

export function GET() {
  const rows = database().prepare('SELECT key, value FROM settings WHERE owner = ?').all(owner) as {
    key: string;
    value: string;
  }[];
  const values = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  return Response.json({ values });
}

export async function PUT(request: Request) {
  const { key, value } = (await request.json().catch(() => ({}))) as {
    key?: string;
    value?: unknown;
  };
  const spec = key ? declarations.get(key) : undefined;
  if (!key || !spec)
    return new Response('This setting is not saved on the server.', { status: 403 });
  let checked: unknown;
  try {
    checked = parseSetting(spec, value, key);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid value.', { status: 400 });
  }
  database()
    .prepare(
      `INSERT INTO settings (owner, key, value) VALUES (?, ?, ?)
       ON CONFLICT (owner, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(owner, key, JSON.stringify(checked));
  return new Response(null, { status: 204 });
}

export function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get('key') ?? '';
  if (!declarations.has(key))
    return new Response('This setting is not saved on the server.', { status: 403 });
  database().prepare('DELETE FROM settings WHERE owner = ? AND key = ?').run(owner, key);
  return new Response(null, { status: 204 });
}
