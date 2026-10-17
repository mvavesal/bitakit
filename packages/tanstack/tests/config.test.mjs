import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  bitakit,
  defineBitaKit,
  generateBitaKit,
} from '../src/config.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-tanstack-'));
  const put = async (name, content) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  const exists = (file) =>
    access(path.join(root, file)).then(
      () => true,
      () => false,
    );
  try {
    await run({ root, put, exists });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const until = async (predicate) => {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail('Discovery did not update within five seconds');
};

test('the Vite plugin runs discovery before the config resolves and wires the generated TanStack entry', async () =>
  fixture(async ({ root, put, exists }) => {
    await put(
      'package.json',
      JSON.stringify({
        name: 'host',
        type: 'module',
        dependencies: { '@tanstack/react-start': '1.0.0' },
      }),
    );
    await put('src/plugins/todos/actions/add.ts', 'export default {};');
    const plugin = bitakit();
    assert.equal(plugin.name, 'bitakit');
    assert.equal(plugin.enforce, 'pre');
    const result = await plugin.config({ root });
    assert.deepEqual(
      result,
      { ssr: { noExternal: [/^@bitakit\//] } },
      'no alias is added; the generated file is a real module',
    );
    assert.equal(await exists('src/bitakit.gen.tsx'), true);
    assert.equal(await exists('src/bitakit.gen.config.ts'), true);
    const provider = await readFile(path.join(root, 'src/bitakit.gen.tsx'), 'utf8');
    const config = await readFile(path.join(root, 'src/bitakit.gen.config.ts'), 'utf8');
    assert.match(provider, /import \{ BitaKitRuntimeProvider \} from '@bitakit\/tanstack';/);
    assert.match(provider, /import \{ createBitaKitConfig \} from '\.\/bitakit\.gen\.config';/);
    assert.match(provider, /export type \{ BitaKitConfig \} from '\.\/bitakit\.gen\.config';/);
    assert.match(provider, /export function BitaKitProvider\(/);
    assert.doesNotMatch(provider, /discoverActions|discoveredFile|createBitaKitConfig\(\) \{/);
    assert.match(config, /export function createBitaKitConfig\(\)/);
    assert.match(config, /discoverActions\(\[file\d+\], "todos"\)/);
    assert.deepEqual(defineBitaKit({ groups: ['menu'] }), { groups: ['menu'] });
    assert.equal((await generateBitaKit(root, { quiet: true })).framework, 'tanstack');
  }));

test('the dev server watcher regenerates on changes and stops when the server closes', async () =>
  fixture(async ({ root, put }) => {
    const plugin = bitakit();
    await plugin.config({ root });
    const output = () => readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    const httpServer = new EventEmitter();
    const errors = [];
    plugin.configureServer({
      config: { root, logger: { error: (message) => errors.push(message) } },
      httpServer,
    });
    await put('src/actions/new.ts', 'export default {};');
    await until(async () => (await output()).includes('actions/new'));
    httpServer.emit('close');
    await rm(path.join(root, 'src/actions/new.ts'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.match(await output(), /actions\/new/, 'a closed server no longer regenerates');
    assert.deepEqual(errors, []);
    plugin.closeBundle();
  }));
