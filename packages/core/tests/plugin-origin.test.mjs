import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  inspectRuntime,
  withPluginOrigin,
  pluginMembership,
  groupPlugins,
  resolveBitaKitConfig,
} from '../dist/core.js';

const bound = (id, kind, memberOf) => withPluginOrigin(definePlugin({ id }), { kind, memberOf });

test('host provenance groups plugins without trusting self-claims or changing runtime definitions', async () => {
  const unknown = definePlugin({
    id: 'unknown',
    metadata: { origin: 'local', memberOf: ['host'] },
  });
  const plugins = [
    bound('local', 'local', ['other']),
    bound('multi', 'package', ['HOST', 'other', 'Other']),
    bound('general', 'package', ['*']),
    bound('mixed', 'package', ['*', 'host']),
    bound('included', 'included'),
    unknown,
  ];
  const runtime = createRuntime({
    bundle: 'HOST',
    knownBundles: [{ id: 'OTHER', label: 'Other app' }],
    plugins,
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    const entries = inspectRuntime(runtime).static.plugins;
    assert.equal(entries[0].application, true);
    assert.equal(entries[0].membership.state, 'derived');
    const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
    assert.deepEqual(byId.local.membership, {
      state: 'derived',
      bundles: [{ id: 'host', resolved: true }],
    });
    assert.deepEqual(byId.multi.membership, {
      state: 'declared',
      bundles: [
        { id: 'host', resolved: true },
        { id: 'other', resolved: true, label: 'Other app' },
      ],
    });
    assert.deepEqual(byId.multi.declaredMembership, ['HOST', 'other', 'Other']);
    for (const id of ['mixed', 'included', 'unknown'])
      assert.equal(byId[id].membership.state, 'unspecified');
    assert.equal(byId.unknown.origin, 'unknown');
    assert.equal(byId.general.membership.state, 'general');
    assert.ok(entries.every((entry) => entry.dependencies.length === 0));
    const groups = groupPlugins(
      entries.filter((entry) => !entry.application),
      'host',
    );
    assert.deepEqual(
      groups.map((group) => [group.key, group.entries.map((entry) => entry.id)]),
      [
        ['application', ['local', 'multi']],
        ['bundle:other', ['multi']],
        ['general', ['general']],
        ['unspecified', ['mixed', 'included', 'unknown']],
      ],
    );
    assert.equal(
      new Set(groups.flatMap((group) => group.entries.map((entry) => entry.id))).size,
      6,
    );
    assert.ok(Object.isFrozen(byId.multi.membership.bundles));
  } finally {
    await stop();
  }
});

test('origins follow definitions through ordering and lifecycle changes, not matching IDs', async () => {
  const local = bound('local', 'local');
  const packaged = withPluginOrigin(definePlugin({ id: 'external' }), {
    kind: 'package',
    package: { name: '@Acme/Notes', version: '1.0.0' },
    memberOf: ['missing'],
  });
  const runtime = createRuntime({ plugins: [packaged, local] });
  const stop = runtime.mount();
  await runtime.ready;
  const inventory = (id) => inspectRuntime(runtime).static.plugins.find((entry) => entry.id === id);
  try {
    assert.equal(inventory('external').package.name, '@acme/notes');
    assert.deepEqual(inventory('external').membership.bundles, [
      { id: 'missing', resolved: false },
    ]);
    assert.deepEqual(inventory('local').membership, { state: 'derived', bundles: [] });
    assert.equal(
      (await runtime.plugins.disable('local', { dependents: 'refuse' })).status,
      'applied',
    );
    assert.equal(inventory('local').origin, 'local');
    assert.equal((await runtime.plugins.enable('local')).status, 'applied');
    assert.equal(inventory('local').origin, 'local');
    assert.equal(
      (await runtime.plugins.remove(['local'], { dependents: 'refuse' })).status,
      'applied',
    );
    assert.equal((await runtime.plugins.add([definePlugin({ id: 'local' })])).status, 'applied');
    assert.equal(inventory('local').origin, 'unknown');
    assert.equal(inventory('local').membership.state, 'unspecified');
  } finally {
    await stop();
  }
  const config = resolveBitaKitConfig({ plugins: [packaged, local] }, { actions: [] });
  const transformed = createRuntime(config);
  assert.equal(
    inspectRuntime(transformed).static.plugins.find((item) => item.id === 'local').origin,
    'local',
  );
  await transformed.stop();
});

test('missing and malformed membership stays unspecified; general is always explicit', () => {
  for (const memberOf of [undefined, null, [], ['*', 'x'], [''], [7]])
    assert.equal(pluginMembership({ kind: 'package', memberOf }).state, 'unspecified');
  assert.equal(pluginMembership({ kind: 'included', memberOf: ['*'] }).state, 'general');
  assert.equal(pluginMembership(undefined, { application: true }).state, 'derived');
});

test('authoritative package binding rejects mismatches and projects canonical metadata without losing legacy UI', async () => {
  const { projectPluginMetadata, packageMetadataSources, getPluginOrigin } = await import(
    '../dist/core.js'
  );
  const icon = () => null;
  const definition = {
    id: 'notes',
    metadata: { name: 'Old title', tags: ['old'], coverImage: '/old.png', icon },
  };
  const record = {
    kind: 'package',
    package: { name: '@Scope/Notes', version: '1' },
    pluginId: 'notes',
    metadata: packageMetadataSources({
      name: '@Scope/Notes',
      version: '1',
      keywords: ['keyword'],
      bitakit: { title: 'New title', tags: [], coverImage: 4 },
    }),
  };
  const bound = withPluginOrigin(definition, record);
  assert.equal(bound.metadata.title, 'New title');
  assert.equal(bound.metadata.name, 'Old title');
  assert.equal(bound.metadata.icon, icon);
  assert.equal(bound.metadata.coverImage, '/old.png');
  assert.deepEqual(bound.metadata.tags, []);
  assert.deepEqual(bound.metadata.keywords, ['keyword']);
  assert.ok(
    getPluginOrigin(bound).metadataWarnings.some((message) => message.includes('display title')),
  );
  assert.equal(definition.metadata.title, undefined);
  assert.throws(
    () => withPluginOrigin({ id: 'different' }, record),
    /@Scope\/Notes.*"notes".*"different"/,
  );
  const invalid = projectPluginMetadata(
    { tags: [3], description: false },
    { tags: ['legacy'], description: 'Legacy' },
  );
  assert.deepEqual(invalid.metadata, { description: 'Legacy', tags: ['legacy'] });
  assert.equal(invalid.warnings.length, 2);
});

test('included folder metadata keeps its existing precedence through host provenance binding', () => {
  const definition = definePlugin({
    id: 'included',
    metadata: { name: 'Existing name', description: 'Existing description' },
  });
  const plugin = withPluginOrigin(definition, {
    kind: 'included',
    package: { name: 'included-package', version: '1' },
    metadata: { canonical: { description: 'Package description', keywords: ['new'] } },
  });
  assert.equal(plugin.metadata.name, 'Existing name');
  assert.equal(plugin.metadata.description, 'Existing description');
  assert.deepEqual(plugin.metadata.keywords, ['new']);
});
