import type { Company } from '@/plugins/companies/services/list';
import { database, problem } from '@/server/database';

// The companies plugin's data. Every request is checked here; the browser is never trusted.

export function GET() {
  const companies = database()
    .prepare('SELECT id, name, industry FROM companies ORDER BY name')
    .all() as Company[];
  return Response.json({ companies });
}

export async function POST(request: Request) {
  const { name, industry } = (await request.json().catch(() => ({}))) as Partial<Company>;
  if (typeof name !== 'string' || !name.trim()) return problem('Give the company a name.');
  const db = database();
  if (db.prepare('SELECT 1 FROM companies WHERE name = ?').get(name.trim()))
    return problem(`${name.trim()} is already in the CRM.`, 409);
  const company: Company = {
    id: 0,
    name: name.trim(),
    industry: typeof industry === 'string' && industry.trim() ? industry.trim() : 'Other',
  };
  company.id = Number(
    db
      .prepare('INSERT INTO companies (name, industry) VALUES (?, ?)')
      .run(company.name, company.industry).lastInsertRowid,
  );
  return Response.json({ company }, { status: 201 });
}
