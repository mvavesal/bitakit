import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createRuntime, resolveBitaKitConfig, getPluginOrigin } from '@bitakit/core';
import { createPackageHost } from '@bitakit/packages';
import { doctor } from '../src/doctor.mjs';
import { link } from './helpers.mjs';
import { describeBitaKit, generateBitaKit } from '@bitakit/discovery';
import { inspectionFromDescription } from '../src/inventory.mjs';
import {
  canonicalPackageName,
  applicationBundles,
  packageOrigin,
  folderMetadata,
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

test('app labels stay unset while included-folder diagnostics project the actual winning source once', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'acme-portal' });
    await put('src/plugin.config.ts', 'export default {};');
    await link(root, '@bitakit/core', 'packages/core');
    await put('bitakit.config.ts', "export default {plugins:{include:{notes:'./included'}}};");
    await put('included/package.json', {
      name: 'notes',
      tags: ['legacy'],
      bitakit: { tags: ['canonical'] },
    });
    await put('included/plugin.config.ts', "export default {metadata:{tags:['folder']}};");
    const description = await describeBitaKit(root);
    assert.equal(description.app.metadata.name, undefined);
    assert.deepEqual(description.plugins[0].metadata.tags, ['folder']);
    assert.equal(new Set(description.metadataWarnings).size, description.metadataWarnings.length);
    assert.equal(description.metadataWarnings.length, 2);
    assert.ok(
      description.metadataWarnings.every((w) =>
        w.includes('included/plugin.config.ts takes precedence'),
      ),
    );
    assert.equal((await generatedConfig(root)).metadata.name, undefined);
  }));

test('generated npm alias catalog loads once and preserves the real package identity', async () =>
  fixture(async (root, put) => {
    await put('package.json', {
      name: 'host',
      type: 'module',
      dependencies: { notes: 'npm:@acme/notes@1.0.0' },
    });
    await put('src/plugin.config.ts', 'export default {};');
    await put('bitakit.config.ts', "export default {catalog:['notes','@acme/notes']};");
    await installedPackage(put, 'node_modules/notes', { name: '@acme/notes', id: 'notes' });
    await put('node_modules/notes/plugin.js', "export default () => ({id:'notes'});");
    await link(root, '@bitakit/core', 'packages/core');
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.deepEqual(description.catalogPackages, ['notes/plugin']);
    await generatedConfig(root);
    const { createBitaKitConfig, packageCatalog } = await import(
      `${pathToFileURL(path.join(root, 'generated-test.mjs')).href}?alias`
    );
    assert.deepEqual(Object.keys(packageCatalog), ['notes']);
    const runtime = createRuntime(createBitaKitConfig());
    const stop = runtime.mount();
    await runtime.ready;
    try {
      assert.equal(runtime.config.plugins.length, 0);
      const host = createPackageHost({ runtime, catalog: packageCatalog });
      assert.equal(
        (await host.reconcile({ scope: 'test', packages: [{ name: 'notes', version: '1.0.0' }] }))
          .status,
        'applied',
      );
      assert.equal(getPluginOrigin(runtime.config.plugins[0]).package.name, '@acme/notes');
    } finally {
      await stop();
    }
  }));

test('nested TypeScript source entries typecheck and execute the selected copy', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', type: 'module', dependencies: { parent: '1' } });
    await put('src/plugin.config.ts', 'export default {};');
    await link(root, '@bitakit/core', 'packages/core');
    await installedPackage(put, 'node_modules/parent', {
      name: 'parent',
      id: 'parent',
      dependencies: { source: '1' },
    });
    await put('node_modules/parent/plugin.js', "export default () => ({id:'parent'});");
    await put('node_modules/parent/node_modules/source/package.json', {
      name: 'source',
      version: '1.0.0',
      type: 'module',
      exports: { './package.json': './package.json', './plugin': './plugin.tsx' },
      bitakit: { plugin: './plugin', id: 'source' },
    });
    await put(
      'node_modules/parent/node_modules/source/plugin.tsx',
      "export default () => ({id:'source',metadata:{name:'Nested'}});",
    );
    const config = await generatedConfig(root);
    assert.equal(config.plugins.find((p) => p.id === 'source').metadata.name, 'Nested');
    const generated = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    const line = generated
      .split('\n')
      .find(
        (line) => line.startsWith('import packagePlugin') && line.includes('node_modules/source/'),
      );
    assert.ok(line);
    await put('src/source-import.ts', line + '\nexport {};');
    const require = createRequire(import.meta.url);
    execFileSync(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--skipLibCheck',
        '--moduleResolution',
        'bundler',
        '--module',
        'esnext',
        '--target',
        'es2022',
        '--jsx',
        'react-jsx',
        'src/source-import.ts',
      ],
      { cwd: root, stdio: 'pipe' },
    );
  }));

test('info reports collisions and runtime IDs without inventing missing package versions', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', dependencies: { one: '*', two: '*' } });
    await put('src/plugin.config.ts', 'export default {};');
    for (const name of ['one', 'two']) {
      await installedPackage(put, `node_modules/${name}`, { name, id: 'same' });
      const file = `node_modules/${name}/package.json`;
      const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8'));
      delete manifest.version;
      await put(file, manifest);
    }
    const cli = path.resolve(import.meta.dirname, '../src/cli.mjs');
    const text = execFileSync(process.execPath, [cli, 'info'], { cwd: root, encoding: 'utf8' });
    assert.match(text, /plugin ID: same/);
    assert.match(text, /Plugin ID "same" conflicts/);
    assert.match(
      text,
      /Static plugin ID conflicts:\n\s+Plugin ID "same" conflicts[^\n]*\n\nLive state:/,
    );
    assert.doesNotMatch(text, /@undefined/);
    const json = JSON.parse(
      execFileSync(process.execPath, [cli, 'info', '--json'], { cwd: root, encoding: 'utf8' }),
    );
    assert.equal(json.diagnostics.identityConflicts.length, 1);
    await assert.rejects(
      generateBitaKit(root),
      (error) => error.message.includes('conflicts') && !error.message.includes('@undefined'),
    );
  }));

test('missing-export diagnostics deduplicate one physical manifest and identify its location', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', dependencies: { a: '1', b: '1', hidden: '1' } });
    await put('src/plugin.config.ts', 'export default {};');
    for (const name of ['a', 'b'])
      await installedPackage(put, `node_modules/${name}`, { name, dependencies: { hidden: '1' } });
    await put('node_modules/hidden/package.json', {
      name: 'hidden',
      exports: { './package.json': './package.json' },
    });
    await put('node_modules/a/node_modules/hidden/package.json', {
      name: 'hidden',
      exports: {},
      bitakit: { plugin: './plugin' },
    });
    await mkdir(path.join(root, 'node_modules/b/node_modules'), { recursive: true });
    await symlink(
      path.join(root, 'node_modules/a/node_modules/hidden'),
      path.join(root, 'node_modules/b/node_modules/hidden'),
    );
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.equal(description.packageWarnings.length, 1);
    assert.match(
      description.packageWarnings[0],
      /node_modules\/a\/node_modules\/hidden\/package.json/,
    );
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

/** Bundle the actual generated entry so assertions cover executable activation, not source text. */
async function generatedConfig(root) {
  await generateBitaKit(root, { quiet: true });
  const outfile = path.join(root, 'generated-test.mjs');
  await build({
    entryPoints: [path.join(root, 'src/bitakit.gen.ts')],
    outfile,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    external: ['@bitakit/core'],
    logLevel: 'silent',
  });
  return (await import(`${pathToFileURL(outfile).href}?${Math.random()}`)).createBitaKitConfig();
}

for (const binding of ['unknown', 'same', 'distinct'])
  test(`duplicate physical copies stay inspectable without double activation (${binding} IDs)`, async () =>
    fixture(async (root, put) => {
      await put('package.json', { name: 'host', dependencies: { parent: '1', shared: '1' } });
      await put('src/plugin.config.ts', 'export default {};');
      await link(root, '@bitakit/core', 'packages/core');
      await installedPackage(put, 'node_modules/parent', {
        name: 'parent',
        id: 'parent',
        dependencies: { shared: '2' },
      });
      await installedPackage(put, 'node_modules/shared', {
        name: 'shared',
        id: binding === 'unknown' ? undefined : 'shared',
        version: '1.0.0',
      });
      await installedPackage(put, 'node_modules/parent/node_modules/shared', {
        name: 'shared',
        id: binding === 'unknown' ? undefined : binding === 'same' ? 'shared' : 'shared-two',
        version: '2.0.0',
        dependencies: { ghost: '1' },
      });
      await installedPackage(put, 'node_modules/parent/node_modules/shared/node_modules/ghost', {
        name: 'ghost',
        id: 'ghost',
      });
      await put('node_modules/parent/plugin.js', "export default () => ({ id: 'parent' });");
      await put('node_modules/shared/plugin.js', "export default () => ({ id: 'shared' });");
      for (const name of ['parent', 'shared']) {
        const file = `node_modules/${name}/package.json`;
        const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8'));
        manifest.bitakit.styles = './styles.css';
        manifest.exports['./styles.css'] = './styles.css';
        await put(file, manifest);
        await put(
          `node_modules/${name}/styles.css`,
          `@layer components { .${name} { color: inherit; } }`,
        );
      }
      const nestedManifestFile = 'node_modules/parent/node_modules/shared/package.json';
      const nestedManifest = JSON.parse(
        await readFile(path.join(root, nestedManifestFile), 'utf8'),
      );
      nestedManifest.bitakit.styles = './missing.css';
      nestedManifest.bitakit.discovery = './discover';
      nestedManifest.exports['./discover'] = './discover.js';
      await put(nestedManifestFile, nestedManifest);
      await put(
        'node_modules/parent/node_modules/shared/discover.js',
        "throw new Error('inactive hook must not run');",
      );
      const description = await describeBitaKit(root, { packageMetadataOnly: true });
      assert.deepEqual(description.styles, ['shared/styles.css', 'parent/styles.css']);
      const copies = Object.values(description.packagePlugins).filter(
        (record) => record.name === 'shared',
      );
      assert.deepEqual(
        copies.map((record) => [record.version, record.selected]),
        [
          ['1.0.0', true],
          ['2.0.0', false],
        ],
      );
      const inventory = (await inspectionFromDescription(description)).static.plugins;
      assert.equal(inventory.find((record) => record.package?.version === '2.0.0').enabled, false);
      assert.equal(inventory.find((record) => record.package?.version === '2.0.0').selected, false);
      if (binding === 'same') {
        const text = execFileSync(
          process.execPath,
          [path.resolve(import.meta.dirname, '../src/cli.mjs'), 'info'],
          { cwd: root, encoding: 'utf8' },
        );
        assert.match(text, /\(not selected\)/);
        assert.doesNotMatch(text, /\(disabled\)/);
      }
      assert.equal(inventory.find((record) => record.package?.name === 'ghost').enabled, false);
      const config = await generatedConfig(root);
      assert.deepEqual(
        config.plugins.map((plugin) => plugin.id),
        ['parent', 'shared'],
      );
      assert.doesNotThrow(() => resolveBitaKitConfig(config));
      const runtime = createRuntime(config);
      runtime.mount();
      await runtime.ready;
      await runtime.stop();
      const report = await doctor({ cwd: root });
      assert.equal(
        report.results.some((result) => result.title === 'Conflicting static plugin IDs'),
        false,
      );
      assert.ok(report.results.find((result) => result.title === 'Installed package copies'));
    }));

for (const conditions of ['browser', 'import'])
  test(`nested plugin resolution follows ${conditions} exports and supports ESM-only packages`, async () =>
    fixture(async (root, put) => {
      await put('package.json', { name: 'host', dependencies: { parent: '1' } });
      await put('src/plugin.config.ts', 'export default {};');
      await link(root, '@bitakit/core', 'packages/core');
      await installedPackage(put, 'node_modules/parent', {
        name: 'parent',
        id: 'parent',
        dependencies: { nested: '1' },
      });
      await put('node_modules/parent/plugin.js', "export default () => ({ id: 'parent' });");
      const directory = 'node_modules/parent/node_modules/nested';
      await put(`${directory}/package.json`, {
        name: 'nested',
        version: '1.0.0',
        type: 'module',
        exports: {
          './package.json': './package.json',
          './plugin':
            conditions === 'browser'
              ? { browser: './browser.js', import: './import.js', require: './require.cjs' }
              : { import: './import.js' },
        },
        bitakit: { plugin: './plugin' },
      });
      for (const name of ['browser', 'import']) {
        await put(
          `${directory}/${name}.js`,
          `export default () => ({ id: '${name}', metadata: { description: '${name.toUpperCase()}_ENTRY' } });`,
        );
        await put(`${directory}/${name}.slots.json`, {
          version: 1,
          pluginId: name,
          definitions: [],
          unresolved: [],
        });
      }
      await put(
        `${directory}/require.cjs`,
        "throw new Error('Node require condition must not load');",
      );
      const description = await describeBitaKit(root, { packageMetadataOnly: true });
      assert.equal(
        Object.values(description.packagePlugins).find((record) => record.name === 'nested')
          .pluginId,
        conditions,
      );
      const config = await generatedConfig(root);
      assert.equal(config.plugins[1].id, conditions);
      assert.equal(config.plugins[1].metadata.description, `${conditions.toUpperCase()}_ENTRY`);
      assert.doesNotThrow(() => resolveBitaKitConfig(config));
    }));

test('local metadata names do not conflict with package identity and diagnostics identify actual files', async () =>
  fixture(async (root, put) => {
    const warnings = [];
    assert.deepEqual(
      folderMetadata(
        'local',
        { name: 'host-package' },
        { name: 'Friendly App', title: 'Local title' },
        warnings,
      ),
      { name: 'Friendly App', title: 'Local title' },
    );
    assert.deepEqual(warnings, []);
    await put('package.json', { name: 'host' });
    await put(
      'bitakit.config.ts',
      "export default { directory: './app/src', plugins: { include: { included: './included/src' } } };",
    );
    await put('app/package.json', { name: 'nested-host', description: 4 });
    await put('app/src/plugin.config.ts', 'export default {};');
    await put('included/package.json', { name: 'included', description: 'Package description' });
    await put(
      'included/src/plugin.config.ts',
      "export default { metadata: { description: 'Existing description' } };",
    );
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.equal(description.plugins[0].metadata.description, 'Existing description');
    assert.ok(
      description.metadataWarnings.some((warning) =>
        warning.includes('metadata.description in app/package.json'),
      ),
    );
    assert.ok(
      description.metadataWarnings.some((warning) =>
        warning.includes(
          'included/src/plugin.config.ts takes precedence over included/package.json',
        ),
      ),
    );
    assert.equal(
      description.metadataWarnings.some((warning) => warning.includes('included/src/package.json')),
      false,
    );
  }));

test('Doctor classifies ignored contribution files by producer, not metadata or bundle substrings', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host' });
    await put('src/plugin.config.ts', 'export default {};');
    for (const name of ['bundle-helper', 'metadata-helper'])
      await put(`src/actions/${name}.ts`, 'export const helper = 1;');
    const { results } = await doctor({ cwd: root });
    assert.equal(
      results.some((result) => result.title === 'Plugin metadata'),
      false,
    );
    assert.equal(
      results.some((result) => result.title === 'Every contribution file has a default export'),
      false,
    );
    const ignored = results.find((result) => /2 files.*ignored by discovery/.test(result.title));
    assert.equal(ignored.status, 'warn');
    assert.equal(ignored.details.length, 2);
    assert.match(ignored.fix, /default export/);
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

test('an inventory-only tree cannot select a dependency ahead of a longer active path', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', dependencies: { parent: '1', shared: '1' } });
    await put('src/plugin.config.ts', 'export default {};');
    for (const [directory, name, dependencies, version] of [
      ['node_modules/parent', 'parent', { shared: '2' }, '1'],
      ['node_modules/shared', 'shared', { bridge: '1' }, '1'],
      ['node_modules/shared/node_modules/bridge', 'bridge', { target: '1' }, '1'],
      ['node_modules/shared/node_modules/bridge/node_modules/target', 'target', undefined, '1'],
      ['node_modules/parent/node_modules/shared', 'shared', { target: '2' }, '2'],
      ['node_modules/parent/node_modules/shared/node_modules/target', 'target', undefined, '2'],
    ])
      await installedPackage(put, directory, { name, dependencies, version });
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.deepEqual(
      Object.values(description.packagePlugins)
        .filter((record) => record.name === 'target')
        .map((record) => [record.version, record.selected]),
      [
        ['1', true],
        ['2', false],
      ],
    );
  }));

test('a root package without opt-in metadata does not activate its nested namesake', async () =>
  fixture(async (root, put) => {
    await put('package.json', { name: 'host', dependencies: { parent: '1', shared: '1' } });
    await put('src/plugin.config.ts', 'export default {};');
    await installedPackage(put, 'node_modules/parent', {
      name: 'parent',
      dependencies: { shared: '2' },
    });
    await put('node_modules/shared/package.json', { name: 'shared', version: '1.0.0' });
    await installedPackage(put, 'node_modules/parent/node_modules/shared', {
      name: 'shared',
      version: '2.0.0',
    });
    const description = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.equal(
      Object.values(description.packagePlugins).find((record) => record.name === 'shared').selected,
      false,
    );
    assert.ok(description.packageWarnings.some((w) => w.includes('already considered earlier')));
    assert.ok(
      description.packageWarnings.every((w) => !w.includes('Only reachable through an unselected')),
    );
  }));
