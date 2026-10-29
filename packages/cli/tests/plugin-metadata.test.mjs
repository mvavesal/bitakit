import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describeBitaKit, generateBitaKit } from '@bitakit/discovery';
import { inspectionFromDescription } from '../src/inventory.mjs';
import {
  canonicalPackageName,
  applicationBundles,
  packageOrigin,
} from '../../discovery/src/plugin-metadata.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-metadata-'));
  const put = async (file, content) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(
      path.join(root, file),
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  };
  try {
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('passive info reads package and folder membership without executing package entries or discovery hooks', async () =>
  fixture(async (root, put) => {
    await put('package.json', {
      name: 'Host-App',
      bitakit: { bundle: '@ACME/Host' },
      dependencies: { extension: '1.0.0' },
    });
    await put(
      'bitakit.config.ts',
      "export default { bundles: [{ id: 'OTHER', label: 'Other app' }], plugins: { include: { included: './included/src' } } };",
    );
    await put(
      'src/plugins/local/plugin.config.ts',
      "export default { metadata: { name: 'Local' }, memberOf: ['other'] };",
    );
    await put('included/package.json', { name: 'included', bitakit: { memberOf: ['*'] } });
    await put('included/src/plugin.config.ts', 'export default {};');
    await put('node_modules/extension/package.json', {
      name: '@ACME/Extension',
      version: '1.0.0',
      type: 'module',
      exports: {
        './package.json': './package.json',
        './plugin': './plugin.js',
        './discover': './discover.js',
      },
      bitakit: {
        plugin: './plugin',
        discovery: './discover',
        memberOf: ['@acme/HOST', 'OTHER', 'unknown'],
      },
    });
    await put('node_modules/extension/plugin.js', "throw new Error('plugin entry executed');");
    await put('node_modules/extension/discover.js', "throw new Error('discovery hook executed');");
    const first = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.deepEqual(first, await describeBitaKit(root, { packageMetadataOnly: true }));
    const inventory = await inspectionFromDescription(first);
    const byId = Object.fromEntries(inventory.static.plugins.map((item) => [item.id, item]));
    assert.equal(first.bundle, '@acme/host');
    assert.equal(byId.local.origin, 'local');
    assert.equal(byId.local.membership.state, 'derived');
    assert.equal(byId.included.origin, 'included');
    assert.equal(byId.included.membership.state, 'general');
    assert.equal(byId['extension/plugin'].package.name, '@acme/extension');
    assert.equal(byId['extension/plugin'].pluginId, null);
    assert.deepEqual(byId['extension/plugin'].membership.bundles, [
      { id: '@acme/host', resolved: true },
      { id: 'other', resolved: true, label: 'Other app' },
      { id: 'unknown', resolved: false },
    ]);
    assert.equal(JSON.stringify(inventory).includes(root), false);
    assert.ok(first.warnings.some((warning) => warning.includes('ignoring its memberOf')));
    await assert.rejects(generateBitaKit(root), /discovery hook executed/);
  }));

test('optional malformed metadata warns without inventing membership or changing IDs', () => {
  assert.equal(canonicalPackageName('@Publisher/My-Plugin'), '@publisher/my-plugin');
  assert.equal(canonicalPackageName('@publisher/../bad'), null);
  const warnings = [];
  for (const memberOf of [[], 'host', ['*', 'host'], ['bad name'], [3]]) {
    const record = packageOrigin('package', { name: 'notes', bitakit: { memberOf } }, warnings);
    assert.equal(record.memberOf, null);
  }
  assert.equal(warnings.length, 5);
  assert.deepEqual(
    applicationBundles(
      { name: 'APP', bitakit: { bundle: 'invalid name' } },
      [
        { id: 'X', label: 'One' },
        { id: 'x', label: 'Two' },
      ],
      warnings,
    ),
    { bundle: 'app', knownBundles: [{ id: 'x' }] },
  );
});

async function installedPackage(
  put,
  directory,
  { name, version = '1.0.0', id, sidecarId, dependencies } = {},
) {
  await put(`${directory}/package.json`, {
    name,
    version,
    type: 'module',
    dependencies,
    exports: { './package.json': './package.json', './plugin': './plugin.js' },
    bitakit: { plugin: './plugin', ...(id ? { id } : {}) },
  });
  await put(`${directory}/plugin.js`, "throw new Error('entry must not execute');");
  await put(`${directory}/plugin.slots.json`, {
    version: 1,
    ...(sidecarId ? { pluginId: sidecarId } : {}),
    definitions: [],
    unresolved: [],
  });
}

test('static identity preserves old sidecars, rejects contradictory evidence and reports scoped collisions', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', dependencies: { '@a/notes': '1', '@b/notes': '1' } });
    await put('src/plugin.config.ts', 'export default {};');
    await installedPackage(put, 'node_modules/@a/notes', { name: '@a/notes', id: 'notes' });
    await installedPackage(put, 'node_modules/@b/notes', { name: '@b/notes', sidecarId: 'notes' });
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    const records = (await inspectionFromDescription(description)).static.plugins.filter(
      (item) => item.origin === 'package',
    );
    assert.equal(records.length, 2);
    assert.deepEqual(
      records.map((item) => item.pluginId),
      ['notes', 'notes'],
    );
    await assert.rejects(
      generateBitaKit(root),
      /Plugin ID "notes" conflicts between package "@a\/notes@1.0.0".*package "@b\/notes@1.0.0"/,
    );
    await installedPackage(put, 'node_modules/@b/notes', {
      name: '@b/notes',
      id: 'other',
      sidecarId: 'notes',
    });
    await assert.rejects(
      describeBitaKit(root, { packageMetadataOnly: true }),
      /contradictory.*manifest "other", sidecar "notes"/,
    );
  }));

test('dependency edges retain two physical versions and generation imports the resolved nested copy', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', dependencies: { parent: '1', shared: '1' } });
    await put('src/plugin.config.ts', 'export default {};');
    await installedPackage(put, 'node_modules/parent', {
      name: 'parent',
      id: 'parent',
      dependencies: { shared: '2' },
    });
    await installedPackage(put, 'node_modules/shared', {
      name: 'shared',
      id: 'shared-one',
      version: '1.0.0',
    });
    await installedPackage(put, 'node_modules/parent/node_modules/shared', {
      name: 'shared',
      id: 'shared-two',
      version: '2.0.0',
    });
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.deepEqual(
      Object.values(description.packagePlugins)
        .filter((record) => record.name === 'shared')
        .map((record) => record.version)
        .sort(),
      ['1.0.0', '2.0.0'],
    );
    await generateBitaKit(root, { quiet: true });
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    assert.match(source, /node_modules\/parent\/node_modules\/shared\/plugin.js/);
    assert.match(source, /"pluginId":"shared-two"/);
    await installedPackage(put, 'node_modules/parent/node_modules/shared', {
      name: 'shared',
      id: 'shared-one',
      version: '2.0.0',
    });
    await assert.rejects(generateBitaKit(root), /shared@1.0.0.*shared@2.0.0/);
  }));

test('passive metadata keeps keywords separate, uses canonical package fields and preserves local precedence', async () =>
  fixture(async (root, put) => {
    await put('package.json', {
      name: 'host',
      description: 'App description',
      dependencies: { notes: '1' },
    });
    await put(
      'src/plugins/local/plugin.config.ts',
      'export default { metadata: { name: "Local title", description: "Local description" } };',
    );
    await put('src/plugins/local/package.json', {
      name: 'local',
      description: 'Package description',
      bitakit: { title: 'Package title must not replace the local title' },
    });
    await installedPackage(put, 'node_modules/notes', { name: 'notes' });
    await put('node_modules/notes/package.json', {
      name: 'notes',
      version: '1.0.0',
      type: 'module',
      keywords: ['npm-keyword'],
      tags: ['old'],
      description: 'Canonical description',
      repository: { type: 'git', url: 'https://example.test/repo' },
      exports: { './package.json': './package.json', './plugin': './plugin.js' },
      bitakit: { plugin: './plugin', title: 'Canonical title', tags: [], coverImage: 42 },
    });
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    const inventory = await inspectionFromDescription(description);
    assert.equal(
      inventory.static.plugins.find((item) => item.id === 'local').metadata.description,
      'Local description',
    );
    assert.equal(
      inventory.static.plugins.find((item) => item.id === 'local').metadata.title,
      undefined,
    );
    const metadata = inventory.static.plugins.find((item) => item.id === 'notes/plugin').metadata;
    assert.equal(metadata.title, 'Canonical title');
    assert.equal(metadata.name, undefined);
    assert.deepEqual(metadata.tags, []);
    assert.deepEqual(metadata.keywords, ['npm-keyword']);
    assert.equal(metadata.repository.url, 'https://example.test/repo');
    assert.ok(description.warnings.some((warning) => warning.includes('metadata.coverImage')));
  }));
