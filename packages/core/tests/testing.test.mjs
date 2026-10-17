import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountPlugin } from '../testing/index.mjs';
import { definePlugin, defineService, defineSlot, isBitaKitStartupError } from '../dist/core.js';

/** A project inside Core, so plugin files resolve @bitakit/core from the workspace. */
async function project(files, run) {
  const root = await mkdtemp(fileURLToPath(new URL('../.copy-', import.meta.url)));
  try {
    for (const [file, source] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), source);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** A plugin folder with services, actions, events.ts, configs, setup and a UI page that must never load in Node. */
const notesPlugin = {
  'package.json': JSON.stringify({ name: 'demo', type: 'module' }),
  'src/plugins/notes/services/items.ts': `import { defineService } from '@bitakit/core';
type Log = { entries: string[]; failStart?: boolean };
export default defineService(({ store, events, services, onStart, onStop }) => {
  const log = (services as any).log as Log;
  const state = store({ items: [] as string[] });
  onStart(async () => {
    await Promise.resolve();
    if (log.failStart) throw new Error('queue unavailable');
    log.entries.push('started');
  });
  onStop(() => log.entries.push('stopped'));
  return {
    state,
    add(title: string) {
      state.set((current) => ({ items: [...current.items, title] }));
      events.emit('notes.changed', { title });
      return title;
    },
  };
});
`,
  'src/plugins/notes/actions/add.ts': `import { defineAction } from '@bitakit/core';
export default defineAction<string, string>({ execute: ({ services, input }) => services.notes.items.add(input) });
`,
  'src/plugins/notes/actions/clear.ts': `import { defineAction } from '@bitakit/core';
export default defineAction({
  enabled: ({ services }) => services.notes.items.state.get().items.length > 0,
  execute: ({ services }) => services.notes.items.state.set({ items: [] }),
});
`,
  'src/plugins/notes/events.ts': `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ changed: event<{ title: string }>() });
`,
  'src/plugins/notes/configs/limits.ts': `export default { maxItems: 3 };
`,
  'src/plugins/notes/setup.ts': `import type { Setup } from '@bitakit/core';
const setup: Setup = ({ scope, services }) => {
  const log = (services as any).log as { entries: string[]; failSetup?: boolean };
  log.entries.push('setup');
  if (log.failSetup) throw new Error('setup exploded');
  scope.actions.getGroup('notes').add({ id: 'notes.count', title: 'Count', execute: () => services.notes.items.state.get().items.length });
  return () => log.entries.push('cleanup');
};
export default setup;
`,
  'src/plugins/notes/slots/header.ts': `import { defineSlot } from '@bitakit/core'; export default defineSlot({ accepts: 'actions' });`,
  'src/plugins/notes/ui/pages/index.tsx': 'export default () => <main />;\n',
};

test('mountPlugin discovers a plugin folder and runs services, actions, events.ts and setup through the runtime lifecycle', () =>
  project(notesPlugin, async (root) => {
    const log = { entries: [] };
    const plugin = await mountPlugin(path.join(root, 'src/plugins/notes'), { services: { log } });
    try {
      assert.equal(plugin.id, 'notes', 'the folder under plugins/ names the plugin');
      assert.equal(
        plugin.runtime.modules.find((module) => module.id === 'notes').slots[0].id,
        'notes.header',
      );
      assert.deepEqual(
        log.entries,
        ['setup', 'started'],
        'mountPlugin resolves after every onStart',
      );
      assert.equal(plugin.app.ready, true);
      assert.equal(plugin.runtime.services, plugin.services);
      assert.equal(plugin.actions.get('notes.clear').enabled, false);
      assert.deepEqual(await plugin.execute('add', 'Write tests'), {
        status: 'completed',
        value: 'Write tests',
      });
      assert.equal((await plugin.execute('notes.count')).value, 1, 'full IDs are accepted as well');
      assert.deepEqual(plugin.services.notes.items.state.get(), { items: ['Write tests'] });
      assert.equal(plugin.app.services.notes.items, plugin.services.notes.items);
      assert.equal(
        plugin.actions.get('notes.clear').enabled,
        true,
        'presentation follows the service store',
      );
      assert.deepEqual(
        plugin.events.recorded.filter((event) => !event.type.startsWith('runtime.')),
        [{ type: 'notes.changed', data: { title: 'Write tests' } }],
      );
      assert.ok(
        plugin.events.recorded.some(
          (event) =>
            event.type === 'runtime.slot' &&
            event.data.id === 'notes.header' &&
            event.data.phase === 'ready',
        ),
      );
      const seen = [];
      plugin.events.on('notes.changed', (event) => seen.push(event.data.title));
      await plugin.execute('add', 'Second');
      assert.deepEqual(seen, ['Second']);
      assert.equal(
        plugin.events.recorded.filter((event) => !event.type.startsWith('runtime.')).length,
        2,
      );
      assert.equal(plugin.app.config.notes.limits.maxItems, 3);
      assert.equal((await plugin.execute('clear')).status, 'completed');
      assert.equal(plugin.actions.get('notes.clear').enabled, false);
    } finally {
      await plugin.stop();
    }
    assert.deepEqual(log.entries, ['setup', 'started', 'cleanup', 'stopped']);
    assert.equal(plugin.actions.get('notes.add'), undefined);
    assert.equal(plugin.app.ready, false);

    const overridden = await mountPlugin(path.join(root, 'src/plugins/notes'), {
      services: { log: { entries: [] } },
      configOverrides: { notes: { limits: { maxItems: 1 } } },
    });
    try {
      assert.equal(overridden.app.config.notes.limits.maxItems, 1);
    } finally {
      await overridden[Symbol.asyncDispose]();
    }
    assert.equal(overridden.app.ready, false);
  }));

test('a failed start or setup rejects with the attributed error and releases everything that was created', () =>
  project(notesPlugin, async (root) => {
    const failing = { entries: [], failStart: true };
    await assert.rejects(
      mountPlugin(path.join(root, 'src/plugins/notes'), { services: { log: failing } }),
      (error) => {
        assert.ok(isBitaKitStartupError(error));
        assert.equal(error.plugin, 'notes');
        assert.match(error.message, /onStart in plugin "notes" failed: queue unavailable/);
        assert.match(error.source, /src\/plugins\/notes\/services\/items\.ts$/);
        return true;
      },
    );
    assert.deepEqual(
      failing.entries,
      ['setup', 'cleanup', 'stopped'],
      'the rejected mount is stopped before the error reaches the test',
    );

    const exploding = { entries: [], failSetup: true };
    await assert.rejects(
      mountPlugin(path.join(root, 'src/plugins/notes'), { services: { log: exploding } }),
      (error) => {
        assert.ok(isBitaKitStartupError(error));
        assert.equal(error.plugin, 'notes');
        assert.match(error.message, /Setup in plugin "notes" failed to start: setup exploded/);
        return true;
      },
    );
    assert.deepEqual(exploding.entries, ['setup', 'stopped']);
  }));

test('mountPlugin derives the ID from the package name, accepts an explicit one and composes dependency plugins', () =>
  project(
    {
      'package.json': JSON.stringify({ name: '@acme/bitakit-notes-plugin', type: 'module' }),
      'src/services/items.ts': `import { defineService } from '@bitakit/core';
export default defineService(({ services }) => ({ theme: () => services.shell.theme.name }), { requires: ['shell.theme'] });
`,
      'src/actions/list.ts': `import { defineAction } from '@bitakit/core';
export default defineAction({ execute: ({ services }) => services.shell.theme.name });
`,
    },
    async (root) => {
      const shell = definePlugin({
        id: 'shell',
        services: { theme: defineService(() => ({ name: 'dark' })) },
      });
      const plugin = await mountPlugin(path.join(root, 'src'), { plugins: [shell] });
      try {
        assert.equal(plugin.id, 'notes');
        assert.equal((await plugin.execute('list')).value, 'dark');
        assert.equal(plugin.services.notes.items.theme(), 'dark');
        assert.deepEqual(
          plugin.events.recorded.filter((event) => !event.type.startsWith('runtime.')),
          [],
        );
      } finally {
        await plugin.stop();
      }
      const custom = await mountPlugin(path.join(root, 'src'), { id: 'custom', plugins: [shell] });
      try {
        assert.equal(custom.id, 'custom');
        assert.ok(custom.actions.get('custom.list'));
        assert.equal(custom.services.custom.items.theme(), 'dark');
      } finally {
        await custom.stop();
      }
      await assert.rejects(mountPlugin(path.join(root, 'src')), (error) => {
        assert.ok(isBitaKitStartupError(error));
        assert.equal(error.plugin, 'notes');
        assert.match(
          error.message,
          /requires service "shell\.theme", but no service has that name/,
        );
        return true;
      });
    },
  ));

test('mountPlugin reads id, dependencies and metadata from plugin.config.ts, so { id } is optional', () =>
  project(
    {
      'package.json': JSON.stringify({ name: 'demo', type: 'module' }),
      'src/plugins/ledger/plugin.config.ts': `export default { id: 'books', dependencies: ['shell'], metadata: { name: 'Ledger' } };
`,
      'src/plugins/ledger/services/entries.ts': `import { defineService } from '@bitakit/core';
export default defineService(({ services }) => ({ theme: () => services.shell.theme.name }));
`,
      'src/plugins/ledger/actions/theme.ts': `import { defineAction } from '@bitakit/core';
export default defineAction({ execute: ({ services }) => services.books.entries.theme() });
`,
      'src/plugins/ledger/setup.ts': `import { scopePlugins, type Setup } from '@bitakit/core';
const setup: Setup = ({ scope, services }) => {
  (services as any).log.plugins = scopePlugins(scope).map(({ id, metadata }) => ({ id, metadata }));
};
export default setup;
`,
    },
    async (root) => {
      const shell = definePlugin({
        id: 'shell',
        services: { theme: defineService(() => ({ name: 'dark' })) },
      });
      const log = {};
      const directory = path.join(root, 'src/plugins/ledger');
      const plugin = await mountPlugin(directory, { plugins: [shell], services: { log } });
      try {
        assert.equal(plugin.id, 'books', 'the manifest ID wins over the folder name');
        assert.equal((await plugin.execute('theme')).value, 'dark');
        assert.equal((await plugin.execute('books.theme')).value, 'dark');
        assert.deepEqual(
          log.plugins.map((item) => item.id),
          ['shell', 'books'],
          'the declared dependency starts first',
        );
        assert.deepEqual(log.plugins[1].metadata, { name: 'Ledger' });
      } finally {
        await plugin.stop();
      }
      const explicit = await mountPlugin(directory, {
        id: 'ledger',
        plugins: [shell],
        services: { log },
      });
      try {
        assert.equal(explicit.id, 'ledger', 'an explicit ID still wins');
      } finally {
        await explicit.stop();
      }
      await assert.rejects(mountPlugin(directory, { services: { log } }), (error) => {
        assert.ok(isBitaKitStartupError(error));
        assert.equal(error.plugin, 'books');
        assert.match(error.message, /Plugin "books" depends on "shell", which is not installed/);
        return true;
      });
    },
  ));

test('mountPlugin mounts other plugin folders from plugins, so a listener is tested against the real emitter', () =>
  project(
    {
      'package.json': JSON.stringify({ name: 'demo', type: 'module' }),
      'src/plugins/notes/events.ts': `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ added: event<{ title: string }>() });
`,
      'src/plugins/notes/actions.ts': `import { defineAction } from '@bitakit/core';
export default {
  add: defineAction<string>({ execute: ({ events, input }) => events.emit('notes.added', { title: input }) }),
};
`,
      'src/plugins/activity/services/feed.ts': `import { defineService } from '@bitakit/core';
export default defineService(({ store, events }) => {
  const state = store({ titles: [] as string[] });
  events.on('notes.added', (event) => state.set((current) => ({ titles: [...current.titles, event.data.title] })));
  return { state };
});
`,
    },
    async (root) => {
      const plugin = await mountPlugin(path.join(root, 'src/plugins/activity'), {
        plugins: [path.join(root, 'src/plugins/notes')],
      });
      try {
        assert.equal(plugin.id, 'activity');
        assert.equal((await plugin.execute('notes.add', 'Ship')).status, 'completed');
        assert.deepEqual(plugin.services.activity.feed.state.get(), { titles: ['Ship'] });
        assert.deepEqual(
          plugin.events.recorded.filter((event) => !event.type.startsWith('runtime.')),
          [{ type: 'notes.added', data: { title: 'Ship' } }],
        );
      } finally {
        await plugin.stop();
      }
    },
  ));

test('a scaffolded plugin placed in shell.navigation mounts with a one-line Shell slot stub', () =>
  project(
    {
      'package.json': JSON.stringify({ name: 'demo', type: 'module' }),
      'src/plugins/notes/actions/open.ts': `import { defineAction } from '@bitakit/core';
export default defineAction({ title: 'Notes', href: '/notes', groups: ['navigation'], slots: ['shell.navigation'] });
`,
    },
    async (root) => {
      const directory = path.join(root, 'src/plugins/notes');
      await assert.rejects(mountPlugin(directory), /Slot "shell\.navigation"/);
      const shell = definePlugin({
        id: 'shell',
        slots: { navigation: defineSlot({ accepts: 'actions' }) },
      });
      const plugin = await mountPlugin(directory, { plugins: [shell] });
      try {
        assert.deepEqual(
          plugin.runtime.slots.get('shell.navigation').items.map((item) => item.actionId),
          ['notes.open'],
        );
      } finally {
        await plugin.stop();
      }
    },
  ));
