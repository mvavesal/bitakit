import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateBitaKit } from '@bitakit/discovery';

async function fixture(t, css, extra = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-style-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, value) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const manifest = {
    name: 'test-plugin', type: 'module',
    exports: { '.': './index.js', './package.json': './package.json', './styles.css': './styles.css' },
    bitakit: { plugin: '.', styles: './styles.css' },
  };
  manifest.bitakit.plugin = './plugin';
  manifest.exports['./plugin'] = './index.js';
  const files = {
    'package.json': { name: 'host', dependencies: { 'test-plugin': '1.0.0' } },
    'node_modules/test-plugin/package.json': manifest,
    'node_modules/test-plugin/index.js': 'export default () => ({ id: "test-plugin" });',
    'node_modules/test-plugin/styles.css': css,
    ...extra,
  };
  for (const [file, value] of Object.entries(files)) await put(file, value);
  return { root, put, manifest, generate: () => generateBitaKit(root, { quiet: true }) };
}

for (const [name, css, message] of [
  ['early layer order', '@layer components; .fixture { display: flex; }', /Do not establish layer order/],
  ['extra reset', '* { padding: 0; margin: 0; }', /Global resets/],
  ['shared token override', ':root { --primary: red; }', /shared tokens/],
  ['base reset layer', '@layer base { input { all: unset; } }', /Base resets/],
]) test(`rejects a plugin's ${name} before generating the host`, async (t) => {
  const f = await fixture(t, css);
  await assert.rejects(f.generate(), message);
});

test('validates imported CSS, not only the manifest entry', async (t) => {
  const f = await fixture(t, '@import "./nested.css";', {
    'node_modules/test-plugin/nested.css': ':root { --radius: 0; }',
  });
  await assert.rejects(f.generate(), /nested.css.*shared tokens/s);
});

test('rejects CSS side effects reached through a lazy emitted module', async (t) => {
  const f = await fixture(t, '.fixture { display: flex; }', {
    'node_modules/test-plugin/index.js': 'export const lazy = () => import("./lazy.js"); export default () => ({});',
    'node_modules/test-plugin/lazy.js': 'import "./styles.css"; export default {};',
  });
  await assert.rejects(f.generate(), /lazy.js.*bypasses the root/);
});

test('valid lazy plugins use one eager generated stylesheet with the canonical prelude', async (t) => {
  const f = await fixture(t, '@layer components { .fixture { padding: 1rem; } }', {
    'node_modules/test-plugin/index.js': 'export const lazy = () => import("./lazy.js"); export default () => ({});',
    'node_modules/test-plugin/lazy.js': 'export default () => null;',
  });
  await f.generate();
  const css = await readFile(path.join(f.root, 'src/bitakit.gen.css'), 'utf8');
  assert.match(css, /@layer theme, base, components, utilities;\n@import "test-plugin\/styles.css";/);
  assert.equal(css.match(/test-plugin\/styles.css/g).length, 1);
});

test('an inaccessible opt-in manifest is diagnosed instead of silently disappearing', async (t) => {
  const f = await fixture(t, '.fixture {}');
  delete f.manifest.exports['./package.json'];
  await f.put('node_modules/test-plugin/package.json', f.manifest);
  await assert.rejects(f.generate(), /test-plugin.*Export "\.\/package.json"/);
});
