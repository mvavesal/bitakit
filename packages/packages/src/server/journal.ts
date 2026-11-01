import { DatabaseSync } from 'node:sqlite';
import type { PackageJournal, PackageRecord } from '../artifacts.js';

/** One coordinator/session per journal key. SQLite makes intent durable and rejects stale writers. */
export function createPackageJournal(
  filename: string,
  key: string,
): PackageJournal & { close(): void } {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');
  db.exec(
    'CREATE TABLE IF NOT EXISTS bitakit_packages (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, record TEXT)',
  );
  db.prepare('INSERT OR IGNORE INTO bitakit_packages VALUES (?, 0, NULL)').run(key);
  return {
    async read() {
      const row = db
        .prepare('SELECT revision, record FROM bitakit_packages WHERE id = ?')
        .get(key)!;
      return {
        revision: Number(row.revision),
        record: row.record ? (JSON.parse(String(row.record)) as PackageRecord) : null,
      };
    },
    async write(expected, record) {
      const result = db
        .prepare(
          'UPDATE bitakit_packages SET revision = revision + 1, record = ? WHERE id = ? AND revision = ?',
        )
        .run(JSON.stringify(record), key, expected);
      if (result.changes !== 1)
        throw new Error(
          'Package journal changed in another coordinator. Reopen and recover before retrying.',
        );
      return expected + 1;
    },
    close() {
      db.close();
    },
  };
}
