import { createRuntime, definePlugin, defineService } from '@bitakit/core';
import { createPackageHost } from '../../dist/index.js';
import { createPackageJournal } from '../../dist/server/index.js';
const [file, point] = process.argv.slice(2);
const journal = createPackageJournal(file, 'session');
const park = async (name) => {
  if (point !== name) return;
  setInterval(() => {}, 1000);
  process.stdout.write(`${name}\n`);
  await new Promise(() => {});
};
let starts = 0;
const provider = {
  async resolve(selection) {
    return {
      artifact: {
        id: selection.version,
        name: 'notes',
        version: selection.version,
        source: 'fixture',
        pluginIds: ['notes'],
      },
      load: async () => ({
        plugins: [
          definePlugin({
            id: 'notes',
            services: {
              value: defineService(({ onStart }) => {
                onStart(async () => {
                  if (selection.version === '1') {
                    if (++starts > 1) await park('rollback');
                  } else {
                    await park('candidate');
                    if (point === 'rollback') throw Error('candidate failed');
                  }
                });
                return { version: selection.version };
              }),
            },
          }),
        ],
      }),
    };
  },
};
const recording = {
  read: () => journal.read(),
  async write(revision, record) {
    const next = await journal.write(revision, record);
    if (record.pending?.after.packages[0]?.version === '2') await park('intent');
    if (!record.pending && record.active.packages[0]?.version === '2') await park('commit');
    return next;
  },
};
const runtime = createRuntime({});
runtime.mount();
await runtime.ready;
const host = createPackageHost({
  runtime,
  dynamic: { provider, journal: recording, dataCompatibility: 'unchanged' },
});
await host.reconcile({ scope: 'A', packages: [{ name: 'notes', version: '1' }] });
await host.reconcile({ scope: 'A', packages: [{ name: 'notes', version: '2' }] });
throw Error('The worker did not reach its requested kill point.');
