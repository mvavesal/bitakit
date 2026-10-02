import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const mail = fileURLToPath(new URL('.env.mail.local', root));
if (existsSync(mail)) process.loadEnvFile(mail);
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('node_modules/next/dist/bin/next', root)),
    process.argv.includes('--production') ? 'start' : 'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3101',
  ],
  {
    cwd: fileURLToPath(new URL('apps/web', root)),
    env: process.env,
    stdio: 'inherit',
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
