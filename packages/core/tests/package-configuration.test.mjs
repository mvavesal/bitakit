import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import { generateFoundation, describeFoundation } from '@bitakit/discovery';

const coreRuntime = new URL('../dist/core.js', import.meta.url).pathname;

async function fixture(run) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'bitakit-packages-')));
  const put = async (file, source) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
  };
  /** An installed package whose files are all exported, so discovery and the generated imports can resolve them. */
  const install = async (name, manifest, files = {}) => {
    const exports = Object.fromEntries(
      Object.keys(files).map((file) => [`./${file.replace(/\.js$/, '')}`, `./${file}`]),
    );
    await put(
      `node_modules/${name}/package.json`,
      JSON.stringify({
        name,
        exports: { './package.json': './package.json', ...exports },
        ...manifest,
      }),
    );
    for (const [file, source] of Object.entries(files))
      await put(`node_modules/${name}/${file}`, source);
  };
  try {
    await run({ root, put, install });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const pluginIds = async (root) => {
  const { generated } = await generateFoundation(root, { quiet: true });
  const { createBitaKitConfig } = await createJiti(import.meta.url, {
    moduleCache: false,
    alias: { '@bitakit/core': coreRuntime },
  }).import(generated);
  return createBitaKitConfig().plugins;
};
const factory = (id) =>
  `export default function plugin(options = {}) { return { id: '${id}', metadata: { options } }; }`;

test('an installed package reads its options from the app config named by bitakit.configuration', async () =>
  fixture(async ({ root, put, install }) => {
    await install(
      '@acme/search',
      { bitakit: { plugin: './plugin', configuration: 'quick-search' } },
      { 'plugin.js': factory('search') },
    );
    await install(
      '@acme/legacy',
      { foundation: { plugin: './plugin', configuration: 'legacy.options' } },
      { 'plugin.js': factory('legacy') },
    );
    await put(
      'package.json',
      JSON.stringify({ dependencies: { '@acme/search': '1.0.0', '@acme/legacy': '1.0.0' } }),
    );
    const options = async () =>
      Object.fromEntries(
        (await pluginIds(root)).map((plugin) => [plugin.id, plugin.metadata.options]),
      );
    // Without an app config file, the packages keep their defaults.
    assert.deepEqual(await options(), { legacy: {}, search: {} });
    const source = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    assert.match(
      source,
      /import packagePlugin0 from '@acme\/legacy\/plugin';\nimport packagePlugin1 from '@acme\/search\/plugin';/,
    );
    assert.match(
      source,
      /packagePlugin0\(options\.get\("legacy\.options", \{\}\)\),\s+packagePlugin1\(options\.get\("quick-search", \{\}\)\)/,
    );
    assert.match(
      source,
      /const options = new ConfigService\(\[\{ id: "app", config: appConfig \}\], \{ \["app"\]: configOverrides\["app"\] \?\? \{\} \}\)\.plugin\("app"\);/,
    );
    assert.match(
      source,
      /type InstalledPlugins = \[ReturnType<typeof packagePlugin0>, ReturnType<typeof packagePlugin1>\];/,
    );
    assert.match(source, /interface ServiceMap extends DiscoveredServices, InstalledServices \{\}/);
    await put(
      'src/configs/quick-search.ts',
      `
      import { defineConfig } from '@bitakit/core';
      export default defineConfig({ defaults: { results: { plugins: true } } });
    `,
    );
    await put('src/configs/legacy.ts', `export default { options: { theme: 'dark' } };`);
    assert.deepEqual(await options(), {
      legacy: { theme: 'dark' },
      search: { results: { plugins: true } },
    });
    // bitakit.config.ts overrides of the app module reach the package options as well.
    await put(
      'bitakit.config.ts',
      `export default { configOverrides: { app: { 'quick-search': { results: { plugins: false } } } } };`,
    );
    assert.deepEqual(await options(), {
      legacy: { theme: 'dark' },
      search: { results: { plugins: false } },
    });
  }));

test('plugin packages activate the plugin packages they depend on; selection and devDependencies are respected', async () =>
  fixture(async ({ root, put, install }) => {
    await install(
      '@acme/shell',
      {
        dependencies: { '@acme/prefs': '1.0.0', 'left-pad': '1.0.0' },
        bitakit: { plugin: './plugin' },
      },
      { 'plugin.js': factory('shell') },
    );
    await install(
      '@acme/prefs',
      { peerDependencies: { '@acme/theme': '1.0.0' }, foundation: { plugin: './plugin' } },
      { 'plugin.js': factory('prefs') },
    );
    await install(
      '@acme/theme',
      { bitakit: { plugin: './plugin' } },
      { 'plugin.js': factory('theme') },
    );
    await install('@acme/headless', { dependencies: { '@acme/theme': '1.0.0' }, bitakit: {} });
    await install('left-pad', {});
    await install(
      '@acme/dev-only',
      { bitakit: { plugin: './plugin' } },
      { 'plugin.js': factory('dev') },
    );
    await put(
      'package.json',
      JSON.stringify({
        dependencies: { '@acme/shell': '1.0.0', 'left-pad': '1.0.0', '@acme/headless': '1.0.0' },
        devDependencies: { '@acme/dev-only': '1.0.0' },
      }),
    );
    // Breadth first: direct dependencies, then what they depend on (@acme/headless pulls in @acme/theme).
    assert.deepEqual(
      (await pluginIds(root)).map((plugin) => plugin.id),
      ['shell', 'theme', 'prefs'],
    );
    const description = await describeFoundation(root);
    assert.deepEqual(description.packages, [
      '@acme/shell/plugin',
      '@acme/theme/plugin',
      '@acme/prefs/plugin',
    ]);
    assert.deepEqual(description.installedPackages, [
      '@acme/headless',
      '@acme/shell',
      '@acme/theme',
      '@acme/prefs',
    ]);

    await put('bitakit.config.ts', `export default { packages: { '@acme/prefs': false } };`);
    assert.deepEqual(
      (await pluginIds(root)).map((plugin) => plugin.id),
      ['shell', 'theme'],
      'a deselected package neither loads nor activates its own dependencies',
    );
    await put(
      'bitakit.config.ts',
      `export default { packages: { '@acme/prefs': false, '@acme/headless': false } };`,
    );
    assert.deepEqual(
      (await pluginIds(root)).map((plugin) => plugin.id),
      ['shell'],
    );
    await put('bitakit.config.ts', `export default { packages: false };`);
    assert.deepEqual(await pluginIds(root), []);
    assert.deepEqual((await describeFoundation(root)).installedPackages, []);
    const source = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    assert.doesNotMatch(source, /packagePlugin|PublicServicesOf|ConfigService/);
    assert.match(source, /type InstalledServices = \{\};/);
  }));

test('package metadata is validated: exports stay inside the package', async () =>
  fixture(async ({ root, put, install }) => {
    await install('@acme/bad', { bitakit: { plugin: '../outside' } });
    await put('package.json', JSON.stringify({ dependencies: { '@acme/bad': '1.0.0' } }));
    await assert.rejects(
      generateFoundation(root, { quiet: true }),
      /Invalid BitaKit export in package "@acme\/bad"/,
    );
    await install('@acme/bad', { bitakit: { plugin: 'plugin' } });
    await assert.rejects(
      describeFoundation(root),
      /Invalid BitaKit export in package "@acme\/bad"/,
    );
  }));

test('manifest dependencies join the dependencies of the generated package plugin', async () =>
  fixture(async ({ root, put, install }) => {
    await install(
      '@acme/base',
      { bitakit: { plugin: './plugin' } },
      { 'plugin.js': factory('base') },
    );
    await install(
      '@acme/addon',
      { bitakit: { plugin: './plugin', dependencies: ['base'] } },
      {
        'plugin.js':
          "export default function plugin() { return { id: 'addon', dependencies: ['base', 'shell'] }; }",
      },
    );
    await put(
      'package.json',
      JSON.stringify({ dependencies: { '@acme/addon': '1.0.0', '@acme/base': '1.0.0' } }),
    );
    const plugins = await pluginIds(root);
    assert.deepEqual(
      plugins.map((plugin) => [plugin.id, plugin.dependencies]),
      [
        ['addon', ['base', 'shell']],
        ['base', undefined],
      ],
    );
    const source = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    assert.match(
      source,
      /withDependencies\(packagePlugin0\(\), \["base"\]\),\s+packagePlugin1\(\)/,
    );
    await install(
      '@acme/broken',
      { bitakit: { plugin: './plugin', dependencies: ['Not an ID'] } },
      { 'plugin.js': factory('broken') },
    );
    await put('package.json', JSON.stringify({ dependencies: { '@acme/broken': '1.0.0' } }));
    await assert.rejects(
      generateFoundation(root, { quiet: true }),
      /Invalid plugin dependency in the bitakit manifest of package "@acme\/broken"/,
    );
  }));
