import type { Deal, Stage } from '@/plugins/deals/services/board';
import { database, problem } from '@/server/database';

// The deals plugin's data: one row per deal, with the stage it is in. The database's CHECK
// constraint allows the same stages.
const stages: readonly Stage[] = ['lead', 'qualified', 'proposal', 'won', 'lost'];

const select = 'SELECT id, company_id AS companyId, title, value, stage FROM deals';

export function GET() {
  const deals = database().prepare(`${select} ORDER BY value DESC`).all() as Deal[];
  return Response.json({ deals });
}

export async function POST(request: Request) {
  const { companyId, title, value } = (await request.json().catch(() => ({}))) as Partial<Deal>;
  const db = database();
  if (!db.prepare('SELECT 1 FROM companies WHERE id = ?').get(Number(companyId)))
    return problem('This company no longer exists.', 404);
  if (typeof title !== 'string' || !title.trim()) return problem('Give the deal a title.');
  if (!Number.isInteger(value) || Number(value) <= 0)
    return problem('Enter the deal value in whole euros.');
  const { lastInsertRowid } = db
    .prepare("INSERT INTO deals (company_id, title, value, stage) VALUES (?, ?, ?, 'lead')")
    .run(Number(companyId), title.trim(), Number(value));
  const deal = db.prepare(`${select} WHERE id = ?`).get(lastInsertRowid) as Deal;
  return Response.json({ deal }, { status: 201 });
}

// Moves a deal to another stage: { id, stage }.
export async function PATCH(request: Request) {
  const { id, stage } = (await request.json().catch(() => ({}))) as { id?: unknown; stage?: Stage };
  if (!stage || !stages.includes(stage)) return problem('Choose one of the pipeline stages.');
  const db = database();
  const { changes } = db.prepare('UPDATE deals SET stage = ? WHERE id = ?').run(stage, Number(id));
  if (changes === 0) return problem('This deal no longer exists.', 404);
  return Response.json({ deal: db.prepare(`${select} WHERE id = ?`).get(Number(id)) as Deal });
}
