import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountPlugin } from '../testing/index.mjs';
import { isFoundationStartupError } from '../dist/core.js';

/** A plugin package inside Core, so its files resolve @bitakit/core from the workspace. */
async function pluginPackage(files, run) {
  const root = await mkdtemp(fileURLToPath(new URL('../.copy-', import.meta.url)));
  try {
    for (const [file, source] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), source);
    }
    await run(path.join(root, 'src'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('mountPlugin runs the plugin setup through the runtime lifecycle and rolls back a failed start', () =>
  pluginPackage(
    {
      'package.json': JSON.stringify({ name: 'bitakit-tasks' }),
      'src/services/tasks.ts': `import { defineService } from '@bitakit/core';
type Log = { entries: string[]; fail: boolean };
export default defineService({
  create({ services }) {
    const log = (services as unknown as { log: Log }).log;
    log.entries.push('service created');
    return { log, items: ['first'] };
  },
  dispose(tasks) { tasks.log.entries.push('service disposed'); },
});
`,
      'src/setup.ts': `import type { Setup } from '@bitakit/core';
type Log = { entries: string[]; fail: boolean };
const setup: Setup = ({ app, services }) => {
  const log = (services as unknown as { log: Log }).log;
  log.entries.push('setup');
  app.actions.getGroup('tasks').add({ id: 'tasks.count', title: 'Count', execute: () => services.tasks.items.length });
  app.own(() => log.entries.push('scope released'));
  if (log.fail) throw new Error('queue unavailable');
  return () => log.entries.push('setup cleanup');
};
export default setup;
`,
    },
    async (directory) => {
      const log = { entries: [], fail: false };
      const plugin = await mountPlugin(directory, { services: { log } });
      try {
        assert.deepEqual(log.entries, ['service created', 'setup']);
        assert.equal((await plugin.execute('count')).value, 1);
      } finally {
        plugin.stop();
      }
      assert.deepEqual(log.entries.slice(2), ['setup cleanup', 'scope released', 'service disposed']);
      assert.equal(plugin.actions.get('tasks.count'), undefined);

      const failing = { entries: [], fail: true };
      await assert.rejects(mountPlugin(directory, { services: { log: failing } }), (error) => {
        assert.ok(isFoundationStartupError(error));
        assert.equal(error.plugin, 'tasks');
        assert.match(error.message, /Setup in plugin "tasks" failed to start: queue unavailable/);
        return true;
      });
      // Everything the failed start created is released before the error reaches the test.
      assert.deepEqual(failing.entries, ['service created', 'setup', 'scope released', 'service disposed']);
    },
  ));

test('mountPlugin discovers a plugin folder and runs it headlessly', async () => {
  // Inside the package so the plugin files resolve @bitakit/core from the workspace.
  const root = await mkdtemp(fileURLToPath(new URL('../.copy-', import.meta.url)));
  try {
    const put = async (file, source) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), source);
    };
    await put('package.json', JSON.stringify({ name: '@acme/bitakit-notes-plugin' }));
    await put('src/services/notes.ts', `import { defineService } from '@bitakit/core';
export default defineService({
  create({ events }) {
    const items: string[] = [];
    return { list: () => items, add(title: string) { items.push(title); events.emit('notes.changed'); } };
  },
});
`);
    await put('src/actions/add.ts', `import { defineAction } from '@bitakit/core';
export default defineAction<string>({ requires: ['notes'], execute: ({ services, input }) => services.notes.add(input) });
`);
    await put('src/actions/clear.ts', `import { defineAction } from '@bitakit/core';
export default defineAction({
  requires: ['notes'],
  enabled: false,
  events: ['notes.changed'],
  onEvent(_event, { services, action }) { action.enabled = services.notes.list().length > 0; },
  execute: () => {},
});
`);
    await put('src/pages/notes.tsx', 'export default { path: "/notes", component: () => <main /> };');
    const plugin = await mountPlugin(path.join(root, 'src'));
    try {
      assert.equal(plugin.id, 'notes');
      assert.equal(plugin.actions.get('notes.clear')?.enabled, false);
      assert.equal((await plugin.execute('add', 'Write tests')).status, 'completed');
      assert.deepEqual(plugin.services.notes.list(), ['Write tests']);
      assert.equal(plugin.app.services.notes.list().length, 1);
      assert.equal(plugin.actions.get('notes.clear')?.enabled, true);
    } finally {
      plugin.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
