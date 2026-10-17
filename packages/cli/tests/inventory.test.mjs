import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectionFromDescription } from '../src/inventory.mjs';
import { describeBitaKit, navigationPlacement } from '@bitakit/discovery';

test('static inventory records unresolved files/packages without inventing runtime facts or values', async () => {
  const result = await inspectionFromDescription({
    app: { id: 'app', directory: 'src', configs: [{ path: '', file: 'src/configs/api.ts' }] },
    plugins: [
      {
        id: 'off',
        enabled: false,
        directory: 'src/plugins/off',
        actions: [{ path: 'list', file: 'src/plugins/off/actions/list.ts' }],
      },
    ],
    packages: ['@example/plugin/entry'],
    slotDeclarations: [],
    root: '/private/root',
    configurations: { token: 'secret' },
  });
  assert.equal(result.version, 1);
  assert.equal(result.live, null);
  assert.equal(result.static.plugins[1].enabled, false);
  assert.equal(result.static.plugins[1].declarations[0].id, null);
  assert.equal(result.static.plugins[2].pluginId, null);
  assert.equal(result.static.plugins[2].declarations, null);
  assert.equal(JSON.stringify(result).includes('/private/root'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('navigation migration requires an explicit target, preserves groups, and avoids spreads or duplicates', () => {
  const source = `import { defineAction as action } from '@bitakit/core';\nexport default action({ title: 'Home', groups: ['navigation'], href: '/' });`;
  assert.equal(navigationPlacement(source).changed, 0);
  assert.equal(navigationPlacement(source).missing.length, 1);
  const migrated = navigationPlacement(source, 'shell.navigation');
  assert.equal(migrated.changed, 1);
  assert.match(migrated.code, /groups: \['navigation'\]/);
  assert.match(migrated.code, /slots: \["shell.navigation"\]/);
  assert.equal(navigationPlacement(migrated.code, 'shell.navigation').changed, 0);
  assert.equal(
    navigationPlacement(source.replace("title: 'Home',", '...options,'), 'shell.navigation')
      .changed,
    0,
  );
  assert.equal(
    navigationPlacement(source.replace("'@bitakit/core'", "'unrelated'"), 'shell.navigation')
      .changed,
    0,
  );
});

test('static catalog entries do not claim runtime activation', async () => {
  const result = await inspectionFromDescription({
    app: { id: 'app', directory: 'src' },
    plugins: [],
    packages: ['notes/plugin'],
    catalogPackages: ['notes/plugin'],
    slotDeclarations: [],
  });
  assert.equal(result.static.plugins.find((plugin) => plugin.id === 'notes/plugin').enabled, null);
  assert.equal(result.live, null);
});

test('info resolves the IDs a developer types: Actions, services, page URLs, events, settings and slots', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-info-'));
  const put = async (file, source) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), source);
  };
  try {
    await put('package.json', JSON.stringify({ name: 'app', dependencies: { next: '16.0.0' } }));
    await put(
      'src/plugins/notes/actions.ts',
      "import { defineAction } from '@bitakit/core';\nexport default { add: defineAction({ execute() {} }), team: { invite: defineAction({ execute() {} }) } };\n",
    );
    await put(
      'src/plugins/notes/services/items.ts',
      "import { defineService } from '@bitakit/core';\nexport default defineService(({ store }) => ({ state: store({}) }));\n",
    );
    await put(
      'src/plugins/notes/ui/pages/index.tsx',
      'export default function Page() { return null; }\n',
    );
    await put(
      'src/plugins/notes/ui/pages/team/archive.tsx',
      'export default function Page() { return null; }\n',
    );
    await put(
      'src/plugins/notes/events.ts',
      "import { defineEvents, event } from '@bitakit/core';\nexport default defineEvents({ added: event(), removed: event() });\n",
    );
    await put(
      'src/plugins/notes/settings.ts',
      "import { defineSettings, setting } from '@bitakit/core';\nexport default defineSettings({ size: setting({ default: 20 }) });\n",
    );
    await put(
      'src/plugins/notes/ui/slots/app-bar.end.tsx',
      'export default function Widget() { return null; }\n',
    );
    await put(
      'src/plugins/notes/slots/tools.ts',
      "import { defineSlot } from '@bitakit/core';\nexport default defineSlot({ accepts: 'actions' });\n",
    );
    await put('src/ui/pages/about.tsx', 'export default function About() { return null; }\n');
    await put(
      'src/settings.ts',
      "import { defineSettings, setting } from '@bitakit/core';\nexport default defineSettings({ theme: setting({ default: 'light' }) });\n",
    );
    const inventory = await inspectionFromDescription(await describeBitaKit(root));
    const ids = (id) =>
      inventory.static.plugins
        .find((plugin) => plugin.id === id)
        .declarations.map((entry) => `${entry.kind} ${entry.id}`)
        .sort();
    assert.deepEqual(ids('notes'), [
      'action notes.add',
      'action notes.team.invite',
      'event notes.added',
      'event notes.removed',
      'page /notes',
      'page /notes/team/archive',
      'service notes.items',
      'setting notes.size',
      'slot notes.tools',
      'widget app-bar.end',
    ]);
    // App contributions are unprefixed, as at runtime.
    assert.deepEqual(ids('app'), ['page /about', 'setting theme']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
