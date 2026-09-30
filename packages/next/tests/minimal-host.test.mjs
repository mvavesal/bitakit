import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateFoundation } from '../src/generate.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withFoundation } from '../src/config.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'foundation-minimal-'));
  const put = async (name, content) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  try {
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('no config or required folders: discovery creates a typed default composition', async () =>
  fixture(async (root) => {
    await generateFoundation(root);
    const generated = await readFile(path.join(root, '.foundation/app.ts'), 'utf8');
    assert.match(generated, /createFoundationConfig/);
    assert.match(generated, /type InstalledPlugins = \[\]/);
  }));

test('installed opt-in package factories are imported, typed, disabled and removed without executing them', async () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ dependencies: { 'document-plugin': '1.0.0' } }));
    await put(
      'node_modules/document-plugin/package.json',
      JSON.stringify({
        name: 'document-plugin',
        version: '1.0.0',
        type: 'module',
        exports: { './package.json': './package.json', './plugin': './plugin.js' },
        foundation: { plugin: './plugin', configuration: 'documents' },
      }),
    );
    await put(
      'node_modules/document-plugin/plugin.js',
      'throw new Error("Never execute client plugin code during discovery"); export default () => ({});',
    );
    const output = () => readFile(path.join(root, '.foundation/app.ts'), 'utf8');
    await generateFoundation(root);
    assert.match(await output(), /import packagePlugin0 from "document-plugin\/plugin"/);
    assert.match(await output(), /ReturnType<typeof packagePlugin0>/);
    assert.match(await output(), /packagePlugin0\(options.get\("documents", \{\}\)\)/);
    assert.match(await output(), /new ConfigService/);
    await put('foundation.config.ts', 'export default { packages: { "document-plugin": false } };');
    await generateFoundation(root);
    assert.doesNotMatch(await output(), /document-plugin\/plugin/);
    await rm(path.join(root, 'foundation.config.ts'));
    await put('package.json', '{"dependencies":{}}');
    await generateFoundation(root);
    assert.doesNotMatch(await output(), /document-plugin\/plugin/);
  }));

test('explicit discovery kinds replace installed defaults and existing config errors remain errors', async () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ dependencies: { 'preferences-plugin': '1.0.0' } }));
    await put(
      'node_modules/preferences-plugin/package.json',
      JSON.stringify({
        name: 'preferences-plugin',
        type: 'module',
        exports: { './package.json': './package.json', './discovery': './discovery.js' },
        foundation: { discovery: './discovery' },
      }),
    );
    await put(
      'node_modules/preferences-plugin/discovery.js',
      'export default () => [{name:"settings",directory:"settings",from:"preferences-plugin",normalize:"discoverSettings"}];',
    );
    await put('src/settings/theme.ts', 'export default {};');
    await generateFoundation(root);
    const output = () => readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.match(await output(), /settings\/theme/);
    await put(
      'foundation.config.ts',
      'export default { kinds: [{name:"settings",directory:"preferences",from:"preferences-plugin",normalize:"discoverSettings"}] };',
    );
    await generateFoundation(root);
    assert.doesNotMatch(await output(), /settings\/theme/);
    await put(
      'foundation.config.ts',
      'throw new Error("Broken configuration"); export default {};',
    );
    await assert.rejects(generateFoundation(root), /Broken configuration/);
  }));

test('Next aliases preserve host configuration for both bundlers', async () =>
  fixture(async (root) => {
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const generated = path.join(process.cwd(), '.foundation/app.ts');
      const config = await withFoundation({
        turbopack: { resolveAlias: { existing: './existing.ts' } },
        webpack(config) {
          config.hostApplied = true;
          return config;
        },
      })('phase-production-build');
      assert.equal(config.turbopack.resolveAlias.existing, './existing.ts');
      assert.equal(config.turbopack.resolveAlias['@bitakit/next/generated'], generated);
      const webpack = config.webpack({ resolve: { alias: { existing: './existing.ts' } } }, {});
      assert.equal(webpack.hostApplied, true);
      assert.equal(webpack.resolve.alias.existing, './existing.ts');
      assert.equal(webpack.resolve.alias['@bitakit/next/generated$'], generated);
    } finally {
      process.chdir(cwd);
    }
  }));


test('empty generated contributions compile with strict unused-local checks', async () =>
  fixture(async (root, put) => {
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    await symlink(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    await put('package.json', JSON.stringify({ type: 'module' }));
    await generateFoundation(root);
    await put('tsconfig.json', JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      noUnusedLocals: true, noEmit: true, skipLibCheck: true,
    }, include: ['.foundation/**/*.ts'] }));
    execFileSync(process.execPath, [path.join(repository, 'node_modules/typescript/bin/tsc'), '-p', root], { stdio: 'pipe' });
  }));
