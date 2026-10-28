import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The app's SQLite database: `data/bookmarks.db`, created with its table and three sample rows
 * the first time a request needs it. `node:sqlite` ships with Node.js 24, so there is nothing to
 * install. Server code only: the API route in src/app/api imports it; plugins call that route.
 * Delete the data folder to start over.
 */
const file = path.join(process.cwd(), 'data', 'bookmarks.db');

const schema = `
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const samples = [
  ['BitaKit documentation', 'https://mvavesal.github.io/bitakit/docs/'],
  ['Node.js SQLite', 'https://nodejs.org/api/sqlite.html'],
  ['Next.js route handlers', 'https://nextjs.org/docs/app/api-reference/file-conventions/route'],
];

// One connection per server process. The dev server reloads modules on every change, so the
// connection lives on globalThis instead of in a module variable.
const shared = globalThis as typeof globalThis & { bookmarksDatabase?: DatabaseSync };

export function database(): DatabaseSync {
  if (shared.bookmarksDatabase) return shared.bookmarksDatabase;
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(schema);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM bookmarks').get() as {
    count: number;
  };
  if (count === 0) {
    const insert = db.prepare('INSERT INTO bookmarks (title, url) VALUES (?, ?)');
    for (const [title, url] of samples) insert.run(title, url);
  }
  shared.bookmarksDatabase = db;
  return db;
}
