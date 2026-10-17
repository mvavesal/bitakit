import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectionFromDescription } from '../src/inventory.mjs';
import { navigationPlacement } from '@bitakit/discovery';

test('static inventory records unresolved files/packages without inventing runtime facts or values', () => {
  const result = inspectionFromDescription({
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

test('static catalog entries do not claim runtime activation', () => {
  const result = inspectionFromDescription({
    app: { id: 'app', directory: 'src' },
    plugins: [],
    packages: ['notes/plugin'],
    catalogPackages: ['notes/plugin'],
    slotDeclarations: [],
  });
  assert.equal(result.static.plugins.find((plugin) => plugin.id === 'notes/plugin').enabled, null);
  assert.equal(result.live, null);
});
