import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  realpath,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateFoundation, withBitaKit, defineBitaKit } from '../src/config.mjs';

const repository = fileURLToPath(new URL('../../../', import.meta.url));

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-minimal-'));
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
    await run({ root, put, exists, generate: () => generateFoundation(root, { quiet: true }) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('no config or folders: discovery creates a typed default composition', async () =>
  fixture(async ({ root, generate }) => {
    const result = await generate();
    assert.equal(result.framework, 'none');
    const generated = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    assert.match(generated, /export function createBitaKitConfig\(\)/);
    assert.match(generated, /appId: "app"/);
    assert.match(generated, /type InstalledServices = \{\};/);
    assert.match(generated, /plugins: \[\s*\]/);
    assert.match(generated, /\} satisfies FoundationConfig;/);
    assert.doesNotMatch(
      generated,
      /new ConfigService/,
      'no package configuration means no options service',
    );
  }));

test('installed opt-in package factories are imported, typed, disabled and removed without executing them', async () =>
  fixture(async ({ root, put, generate }) => {
    await put('package.json', JSON.stringify({ dependencies: { 'document-plugin': '1.0.0' } }));
    await put(
      'node_modules/document-plugin/package.json',
      JSON.stringify({
        name: 'document-plugin',
        version: '1.0.0',
        type: 'module',
        exports: {
          './package.json': './package.json',
          './plugin': './plugin.js',
          './styles.css': './styles.css',
        },
        bitakit: { plugin: './plugin', configuration: 'documents', styles: './styles.css' },
      }),
    );
    await put(
      'node_modules/document-plugin/plugin.js',
      'throw new Error("Never execute client plugin code during discovery"); export default () => ({});',
    );
    await put('node_modules/document-plugin/styles.css', '');
    const output = () => readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    await generate();
    assert.match(await output(), /import packagePlugin0 from 'document-plugin\/plugin';/);
    assert.match(await output(), /ReturnType<typeof packagePlugin0>/);
    assert.match(await output(), /packagePlugin0\(options\.get\("documents", \{\}\)\)/);
    assert.match(await output(), /new ConfigService/);
    assert.match(
      await readFile(path.join(root, 'src/bitakit.gen.css'), 'utf8'),
      /@import "document-plugin\/styles\.css";/,
    );
    await put('bitakit.config.ts', 'export default { packages: { "document-plugin": false } };');
    await generate();
    assert.doesNotMatch(await output(), /document-plugin\/plugin/);
    await rm(path.join(root, 'bitakit.config.ts'));
    await put('package.json', '{"dependencies":{}}');
    await generate();
    assert.doesNotMatch(await output(), /document-plugin\/plugin/);
  }));

test('explicit discovery kinds replace installed defaults; existing config errors remain errors', async () =>
  fixture(async ({ root, put, generate }) => {
    await put('package.json', JSON.stringify({ dependencies: { 'preferences-plugin': '1.0.0' } }));
    await put(
      'node_modules/preferences-plugin/package.json',
      JSON.stringify({
        name: 'preferences-plugin',
        type: 'module',
        exports: { './package.json': './package.json', './discovery': './discovery.js' },
        bitakit: { discovery: './discovery' },
      }),
    );
    await put(
      'node_modules/preferences-plugin/discovery.js',
      'export default () => [{name:"settings",directory:"settings",from:"preferences-plugin",normalize:"discoverSettings"}];',
    );
    await put('src/contributions/settings/theme.ts', 'export default {};');
    const output = () => readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');
    await generate();
    assert.match(
      await output(),
      /import \{ discoverSettings as normalize\d+ \} from 'preferences-plugin';/,
    );
    assert.match(await output(), /"settings": normalize\d+\(\[file\d+\], "app"\)/);
    assert.match(await output(), /contributions\/settings\/theme/);
    await put(
      'bitakit.config.ts',
      'export default { kinds: [{name:"settings",directory:"preferences",from:"preferences-plugin",normalize:"discoverSettings"}] };',
    );
    await generate();
    assert.doesNotMatch(await output(), /settings\/theme/);
    await put('bitakit.config.ts', 'throw new Error("Broken configuration"); export default {};');
    await assert.rejects(generate(), /Broken configuration/);
  }));

test('withBitaKit runs discovery, transpiles core and leaves bundler aliases alone', async () =>
  fixture(async ({ root, put, exists }) => {
    await put(
      'package.json',
      JSON.stringify({ name: 'host', type: 'module', dependencies: { next: '16.0.0' } }),
    );
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const webpack = (config) => config;
      const config = await withBitaKit({
        transpilePackages: ['existing'],
        experimental: { typedRoutes: true },
        turbopack: { resolveAlias: { existing: './existing.ts' } },
        webpack,
      })('phase-production-build', {});
      assert.equal(
        await exists('src/bitakit.gen.tsx'),
        true,
        'discovery ran before Next read its configuration',
      );
      assert.deepEqual(config.transpilePackages, ['existing', '@bitakit/core']);
      assert.deepEqual(
        config.turbopack,
        { resolveAlias: { existing: './existing.ts' } },
        'no Turbopack alias is added',
      );
      assert.equal(config.webpack, webpack, 'the host webpack hook is passed through untouched');
      assert.equal(config.resolve, undefined);
      assert.deepEqual(
        config.experimental,
        { typedRoutes: true },
        'externalDir is only set for included plugins',
      );
      const minimal = await withBitaKit()('phase-production-build', {});
      assert.deepEqual(minimal, { transpilePackages: ['@bitakit/core'] });
      const fromFunction = await withBitaKit(async (phase) => ({ transpilePackages: [phase] }))(
        'phase-production-build',
        {},
      );
      assert.deepEqual(fromFunction.transpilePackages, ['phase-production-build', '@bitakit/core']);
      assert.deepEqual(defineBitaKit({ groups: ['menu'] }), { groups: ['menu'] });
      const twice = await withBitaKit({ transpilePackages: ['@bitakit/core'] })(
        'phase-production-build',
        {},
      );
      assert.deepEqual(twice.transpilePackages, ['@bitakit/core']);
    } finally {
      process.chdir(cwd);
    }
  }));

test('withBitaKit enables externalDir when plugins are included from outside the project', async () =>
  fixture(async ({ root, put }) => {
    const external = path.join(root, '..', `bitakit-external-${path.basename(root)}`);
    const cwd = process.cwd();
    try {
      await mkdir(path.join(external, 'actions'), { recursive: true });
      await writeFile(path.join(external, 'actions', 'open.ts'), 'export default {};');
      await put(
        'bitakit.config.ts',
        `export default { plugins: { include: { notes: ${JSON.stringify(external)} } } }`,
      );
      process.chdir(root);
      const config = await withBitaKit({ experimental: { typedRoutes: true } })(
        'phase-production-build',
        {},
      );
      assert.deepEqual(config.experimental, { typedRoutes: true, externalDir: true });
      assert.match(await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8'), /id: "notes"/);
    } finally {
      process.chdir(cwd);
      await rm(external, { recursive: true, force: true });
    }
  }));

test('the generated Next entry compiles with strict unused-local checks', async () =>
  fixture(async ({ root, put, generate }) => {
    await symlink(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    await put('package.json', JSON.stringify({ type: 'module', dependencies: { next: '16.0.0' } }));
    await put(
      'src/plugins/todos/services/items.ts',
      "import { defineService } from '@bitakit/core';\nexport default defineService(({ store }) => ({ state: store({ items: [] as string[] }) }));",
    );
    await put(
      'src/plugins/todos/actions/add.ts',
      "import { defineAction } from '@bitakit/core';\nexport default defineAction<string>({ execute: ({ services, input }) => services.todos.items.state.set({ items: [input] }) });",
    );
    await put(
      'src/plugins/todos/ui/pages/index.tsx',
      'export default function Todos() { return null; }',
    );
    await put(
      'src/plugins/todos/ui/pages/tasks/[id].tsx',
      'export default function Task({ params }: { params: { id: string } }) { return params.id; }',
    );
    const result = await generate();
    assert.equal(result.framework, 'next');
    assert.deepEqual(result.warnings, []);
    await put(
      'src/consumer.tsx',
      [
        "import { useAction, useServiceState } from '@bitakit/ui';",
        "import { BitaKitProvider, createBitaKitConfig } from './bitakit.gen';",
        'export function Consumer() {',
        "  const add = useAction('todos.add', 'Milk');",
        "  const items = useServiceState('todos.items', (state) => state.items, []);",
        '  const first: string | undefined = items[0];',
        '  // @ts-expect-error Unknown action IDs are rejected in strict generated projects.',
        "  useAction('todos.unknown');",
        '  // @ts-expect-error Input follows the action map.',
        "  useAction('todos.add', 42);",
        '  return <BitaKitProvider notify={(message, kind) => console.log(kind, message, first, add?.title)}><button {...add?.props()} /></BitaKitProvider>;',
        '}',
        'export const config = createBitaKitConfig();',
      ].join('\n'),
    );
    await put(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(repository, 'node_modules/typescript/bin/tsc'), '-p', await realpath(root)],
      { stdio: 'pipe' },
    );
  }));

test('the Next provider needs a configuration and says where it comes from', async () => {
  // Next resolves `next/navigation` through bundlers; Node needs the file extension added.
  const { register } = await import('node:module');
  register('./next-resolve.hooks.mjs', import.meta.url);
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement: h, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { AppRouterContext } = await import(
    'next/dist/shared/lib/app-router-context.shared-runtime.js'
  );
  const { FoundationProvider } = await import('../dist/index.js');
  const router = {
    push() {},
    replace() {},
    back() {},
    forward() {},
    refresh() {},
    prefetch() {},
    hmrRefresh() {},
  };
  const container = document.createElement('div');
  const root = createRoot(container);
  const error = console.error;
  console.error = () => {};
  try {
    await assert.rejects(async () => {
      await act(async () =>
        root.render(
          h(AppRouterContext.Provider, { value: router }, h(FoundationProvider, null, 'content')),
        ),
      );
    }, /FoundationProvider needs a configuration\. Use <BitaKitProvider> from '\.\/bitakit\.gen', or pass config=\{createBitaKitConfig\(\)\}/);
  } finally {
    console.error = error;
    await act(async () => root.unmount());
  }
});
