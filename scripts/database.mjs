import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('../apps/web/', import.meta.url));
loadEnvConfig(app, true, { info() {}, error() {} });
if (!process.env.DATABASE_URL) throw new Error('Configure the private DATABASE_URL first.');
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/@zenstackhq/cli/bin/cli', import.meta.url)),
    ...process.argv.slice(2),
  ],
  {
    cwd: app,
    env: process.env,
    encoding: 'utf8',
  },
);
const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
for (const output of [result.stdout, result.stderr]) {
  if (output)
    process.stdout.write(
      output
        .replaceAll(process.env.DATABASE_URL, '[database connection]')
        .replaceAll(password, '[redacted]'),
    );
}
process.exit(result.status ?? 1);
