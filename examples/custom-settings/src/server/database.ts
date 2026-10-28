import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Saved settings: `data/settings.db`, one row per owner and key with the value as JSON. It is
 * created on the first request; `node:sqlite` ships with Node.js 24. Server code only. Delete
 * the data folder to go back to the defaults.
 */
const file = path.join(process.cwd(), 'data', 'settings.db');

const schema = `
  CREATE TABLE IF NOT EXISTS settings (
    owner TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (owner, key)
  );
`;

// One connection per server process. The dev server reloads modules on every change, so the
// connection lives on globalThis instead of in a module variable.
const shared = globalThis as typeof globalThis & { settingsDatabase?: DatabaseSync };

export function database(): DatabaseSync {
  if (shared.settingsDatabase) return shared.settingsDatabase;
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(schema);
  shared.settingsDatabase = db;
  return db;
}
