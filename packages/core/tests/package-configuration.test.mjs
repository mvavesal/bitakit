import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import { generateFoundation } from '../discovery/generate.mjs';

test('an installed package reads its options from the app config named by foundation.configuration', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'foundation-configuration-'));
  try {
    const put = async (file, source) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), source);
    };
    await put('node_modules/@acme/search/package.json', JSON.stringify({
      name: '@acme/search',
      exports: { './package.json': './package.json', './foundation': './foundation.js' },
      foundation: { plugin: './foundation', configuration: 'quick-search' },
    }));
    await put('node_modules/@acme/search/foundation.js', `
      export default function plugin(options = {}) { return { id: 'search', metadata: { options } }; }
    `);
    await put('package.json', JSON.stringify({ dependencies: { '@acme/search': '1.0.0' } }));
    const load = async () => {
      await generateFoundation(root);
      const jiti = createJiti(import.meta.url, { moduleCache: false,
        alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname } });
      const { createFoundationConfig } = await jiti.import(path.join(root, '.foundation/app.ts'));
      return createFoundationConfig().plugins.find((plugin) => plugin.id === 'search').metadata.options;
    };
    // Without an app config file, the package keeps its defaults.
    assert.deepEqual(await load(), {});
    await put('src/configs/quick-search.ts', `
      import { defineConfig } from '@bitakit/core';
      export default defineConfig({ defaults: { results: { plugins: true } } });
    `);
    assert.deepEqual(await load(), { results: { plugins: true } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
