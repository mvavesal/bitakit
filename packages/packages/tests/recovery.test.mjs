import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createRuntime, definePlugin, defineService } from '@bitakit/core';
import { createPackageHost } from '../dist/index.js';
import { createPackageJournal } from '../dist/server/index.js';
for (const point of ['intent', 'candidate', 'rollback', 'commit']) {
  test(
    `process termination at ${point} recovers the durable selection on a fresh runtime`,
    { timeout: 20000 },
    async (t) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), 'bitakit-recovery-'));
      t.after(() => rm(dir, { recursive: true, force: true }));
      const file = path.join(dir, 'journal.sqlite');
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/recovery-worker.mjs', import.meta.url)), file, point],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      t.after(() => child.kill('SIGKILL'));
      const closed = new Promise((resolve) => child.once('close', resolve));
      await new Promise((resolve, reject) => {
        let stdout = '',
          stderr = '';
        child.stderr.on('data', (data) => (stderr += data));
        child.stdout.on('data', (data) => {
          stdout += data;
          if (stdout.includes(`${point}\n`)) resolve();
        });
        child.once('exit', (code) =>
          reject(Error(`Worker exited before kill point (${code}): ${stderr}`)),
        );
      });
      child.kill('SIGKILL');
      await closed;
      const journal = createPackageJournal(file, 'session');
      t.after(() => journal.close());
      const expected = point === 'commit' ? '2' : '1';
      const runtime = createRuntime({});
      const stop = runtime.mount();
      await runtime.ready;
      t.after(() => stop());
      const provider = {
        async resolve(s) {
          assert.equal(s.artifact, s.version);
          return {
            artifact: {
              id: s.version,
              name: 'notes',
              version: s.version,
              source: 'fixture',
              pluginIds: ['notes'],
            },
            load: async () => ({
              plugins: [
                definePlugin({
                  id: 'notes',
                  services: { value: defineService(() => ({ version: s.version })) },
                }),
              ],
            }),
          };
        },
      };
      const host = createPackageHost({
        runtime,
        dynamic: { provider, journal, dataCompatibility: 'unchanged' },
      });
      assert.equal((await host.recover()).status, 'applied');
      assert.equal(runtime.services.notes.value.version, expected);
      const saved = await journal.read();
      assert.equal(saved.record.active.packages[0].version, expected);
      assert.equal(saved.record.pending, undefined);
    },
  );
}
