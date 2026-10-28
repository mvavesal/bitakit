import type { Contact } from '@/plugins/contacts/services/list';
import { database, problem } from '@/server/database';

// The contacts plugin's data: people, each at one company.

export function GET() {
  const contacts = database()
    .prepare('SELECT id, company_id AS companyId, name, email FROM contacts ORDER BY name')
    .all() as Contact[];
  return Response.json({ contacts });
}

export async function POST(request: Request) {
  const { companyId, name, email } = (await request.json().catch(() => ({}))) as Partial<Contact>;
  const db = database();
  if (!db.prepare('SELECT 1 FROM companies WHERE id = ?').get(Number(companyId)))
    return problem('This company no longer exists.', 404);
  if (typeof name !== 'string' || !name.trim()) return problem('Give the contact a name.');
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email))
    return problem('Enter an email address such as ada@example.com.');
  const contact: Contact = { id: 0, companyId: Number(companyId), name: name.trim(), email };
  contact.id = Number(
    db
      .prepare('INSERT INTO contacts (company_id, name, email) VALUES (?, ?, ?)')
      .run(contact.companyId, contact.name, contact.email).lastInsertRowid,
  );
  return Response.json({ contact }, { status: 201 });
}
