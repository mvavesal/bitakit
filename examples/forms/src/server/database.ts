import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The help desk's SQLite database: `data/forms.db`, created with its table and two sample
 * tickets the first time a request needs it. `node:sqlite` ships with Node.js 24. Server code
 * only: the API route in src/app/api imports it. Delete the data folder to start over.
 */
const file = path.join(process.cwd(), 'data', 'forms.db');

const schema = `
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    email TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// One connection per server process. The dev server reloads modules on every change, so the
// connection lives on globalThis instead of in a module variable.
const shared = globalThis as typeof globalThis & { formsDatabase?: DatabaseSync };

export function database(): DatabaseSync {
  if (shared.formsDatabase) return shared.formsDatabase;
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(schema);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tickets').get() as { count: number };
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO tickets (title, email, priority, description) VALUES (?, ?, ?, ?)',
    );
    insert.run(
      'Invoice shows the wrong address',
      'ada@example.com',
      'normal',
      'The October invoice still shows our old office address in Berlin.',
    );
    insert.run(
      'Cannot sign in on mobile',
      'grace@example.com',
      'high',
      'The sign-in button does nothing on Safari for iOS since this morning.',
    );
  }
  shared.formsDatabase = db;
  return db;
}
