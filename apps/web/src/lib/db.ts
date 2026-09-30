import 'server-only';
import { ZenStackClient } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import { Pool } from 'pg';
import { schema } from '../../zenstack/schema';

function createDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Database connection is not configured.');
  return new ZenStackClient(schema, {
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 30000,
      }),
    }),
  });
}
const shared = globalThis as typeof globalThis & {
  foundationDatabase?: ReturnType<typeof createDatabase>;
};
// Privileged server-only client for Better Auth. Never expose auth tables via CRUD.
export function getDatabase() {
  return (shared.foundationDatabase ??= createDatabase());
}
