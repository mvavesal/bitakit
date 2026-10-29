import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
  realpath,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import ts from 'typescript';
import {
  generateBitaKit,
  describeBitaKit,
  describeModule,
  detectFramework,
  loadDiscoveryConfig,
  defineBitaKit,
  watchBitaKit,
  migrateProject,
  rewriteRenamedNames,
  rewriteScopeAndSlots,
} from '@bitakit/discovery';
// Internal module: the package exports only its public entry.
import { discoverEntries, files } from '../../discovery/src/entries.mjs';
import { renamed } from '../../discovery/src/migrate.mjs';
import { exportedNames, moveCoreImports } from '../../discovery/src/core-imports.mjs';
import {
  discoverActions,
  discoverServices,
  discoverConfig,
  discoveredFile,
  defineAction,
  defineService,
  defineInterceptor,
  defineConfig,
  BitaKitRuntime,
  BitaKitServiceError,
  createRuntime,
  createActionList,
  ConfigService,
  findPluginPage,
  resolveBitaKitConfig,
} from '../dist/core.js';

const coreRuntime = new URL('../dist/core.js', import.meta.url).pathname;
const coreTypes = new URL('../dist/core.d.ts', import.meta.url).pathname;
const actionTypes = new URL('../dist/actions/core.d.ts', import.meta.url).pathname;

/** A temporary project. The root is resolved so it matches the paths discovery reports. */
async function fixture(run) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'bitakit-discovery-')));
  const put = async (file, source) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
    return target;
  };
  try {
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const file = (value, localPath, source = localPath) => discoveredFile(value, localPath, source);
const exists = (target) =>
  access(target).then(
    () => true,
    () => false,
  );
/** Strict TypeScript errors for generated output and consumers, against this build of Core. */
const typeErrors = (files, root) =>
  ts
    .getPreEmitDiagnostics(
      ts.createProgram(files, {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: root,
        paths: { '@bitakit/core': [coreTypes], '@bitakit/core/actions': [actionTypes] },
      }),
    )
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
/** Loads a generated file the way a bundler would, with `@bitakit/core` pointing at this build. */
const loadGenerated = (generated) =>
  createJiti(import.meta.url, {
    moduleCache: false,
    alias: { '@bitakit/core': coreRuntime },
  }).import(generated);
/** Asserts that every pattern matches exactly one warning and that no other warnings exist. */
function expectWarnings(warnings, patterns) {
  for (const pattern of patterns) {
    const matching = warnings.filter((warning) => pattern.test(warning));
    assert.equal(
      matching.length,
      1,
      `Expected one warning matching ${pattern}, got ${JSON.stringify(warnings, null, 2)}`,
    );
  }
  assert.equal(warnings.length, patterns.length, JSON.stringify(warnings, null, 2));
}
async function until(predicate, timeout = 8000) {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for the watcher.');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

test('the generated file wires app and plugins: nested services, typed events, config and derived UI', async () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ name: 'demo' }));
    await put(
      'bitakit.config.ts',
      `export default { slots: ['sidebar.top'], configOverrides: { todos: { limits: { maxItems: 5 } } } };`,
    );
    await put(
      'src/actions/refresh.ts',
      `
      import { defineAction } from '@bitakit/core';
      export default defineAction({ execute: ({ config }) => config.plugin.get('shell.title', '') });
    `,
    );
    await put('src/configs/shell.ts', `export default { title: 'Demo' };`);
    await put(
      'src/settings.ts',
      `
      import { defineSettings, setting } from '@bitakit/core';
      export default defineSettings({
        theme: setting({ default: 'system', options: [{ value: 'light' }, { value: 'dark' }, { value: 'system' }] }),
      });
    `,
    );
    await put(
      'src/plugins/todos/plugin.config.ts',
      `export default { metadata: { name: 'Todos' } };`,
    );
    await put(
      'src/plugins/todos/services/items.ts',
      `
      import { defineService } from '@bitakit/core';
      export default defineService(({ store, events }) => {
        const state = store({ items: [] as string[] });
        const audit: string[] = [];
        return {
          state,
          audit,
          add(title: string) {
            state.set((current) => ({ items: [...current.items, title] }));
            events.emit('todos.changed', { kind: 'added' });
            return title;
          },
          count: () => state.get().items.length,
        };
      });
    `,
    );
    await put(
      'src/plugins/todos/services/clock.ts',
      `
      import { defineService } from '@bitakit/core';
      export default defineService(() => ({ now: () => new Date() }), { exposeAs: 'clock' });
    `,
    );
    await put(
      'src/plugins/todos/actions/add.ts',
      `
      import { defineAction } from '@bitakit/core';
      export default defineAction<string, string>({ execute: ({ services, input }) => services.todos.items.add(input) });
    `,
    );
    await put(
      'src/plugins/todos/actions/clear.ts',
      `
      import { defineAction } from '@bitakit/core';
      export default defineAction({
        enabled: ({ services }) => services.todos.items.count() > 0,
        execute: ({ services }) => services.todos.items.count(),
      });
    `,
    );
    await put(
      'src/plugins/todos/events.ts',
      `
      import { defineEvents, event } from '@bitakit/core';
      export default defineEvents({
        changed: event<{ kind: 'added' | 'removed' }>(),
        deleting: event<{ id: number }>({ cancelable: true }),
      });
    `,
    );
    await put(
      'src/plugins/todos/settings.ts',
      `
      import { defineSettings, setting } from '@bitakit/core';
      export default defineSettings({ pageSize: setting({ default: 20 }) }, { title: 'Todos' });
    `,
    );
    await put(
      'src/plugins/todos/ui/settings/page.tsx',
      `export default function TodoSettings() { return null; }`,
    );
    await put(
      'src/plugins/todos/configs/limits.ts',
      `
      import { defineConfig } from '@bitakit/core';
      export default defineConfig({ defaults: { maxItems: 100 } });
    `,
    );
    await put(
      'src/plugins/todos/interceptors/audit.ts',
      `
      import { defineInterceptor } from '@bitakit/core';
      export default defineInterceptor({ action: 'todos.*', before: ({ id, services }) => { services.todos.items.audit.push(id); } });
    `,
    );
    await put('src/plugins/todos/ui/pages/index.tsx', 'export default () => null;');
    await put(
      'src/plugins/todos/ui/pages/tasks/[id].tsx',
      "export default () => null;\nexport const layout = 'blank';",
    );
    await put(
      'src/plugins/todos/ui/slots/sidebar.top.tsx',
      'export default () => null;\nexport const order = 5;',
    );
    await put(
      'src/plugins/todos/ui/providers/query.tsx',
      "export default () => null;\nexport const requires = ['theme'];",
    );
    await put('src/plugins/todos/ui/components/button.tsx', 'export default () => null;');
    await put(
      'src/plugins/todos/setup.ts',
      `
      import type { Setup } from '@bitakit/core';
      const setup: Setup = ({ services }) => {
        services.todos.items.audit.push('setup');
        return () => { services.todos.items.audit.push('cleanup'); };
      };
      export default setup;
    `,
    );
    await put(
      'src/plugins/todos/locales/en.json',
      JSON.stringify({ todos: { add: { title: 'Add item' } } }),
    );

    const result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result, {
      included: [],
      styleDirectories: [],
      warnings: [],
      generated: path.join(root, 'src/bitakit.gen.ts'),
      framework: 'none',
    });
    const source = await readFile(result.generated, 'utf8');
    assert.match(source, /^\/\/ Generated by BitaKit\. Do not edit\./);
    assert.match(source, /export function createBitaKitConfig\(\)/);
    assert.match(source, /export type BitaKitConfig = ReturnType<typeof createBitaKitConfig>/);
    assert.match(source, /\} satisfies BitaKitRuntimeConfig;/);
    assert.match(source, /declare module '@bitakit\/core' \{/);
    assert.doesNotMatch(source, /PublicServiceMap/);
    for (const declaration of [
      /interface ServiceMap extends DiscoveredServices, InstalledServices \{\}/,
      /interface ActionMap extends DiscoveredActions, InstalledActions \{\}/,
      /interface EventMap extends DiscoveredEvents, InstalledEvents \{\}/,
      /interface CancelableEventMap extends DiscoveredCancelable, InstalledCancelable \{\}/,
      /interface ConfigMap \{\s+"app": DiscoveredConfigEntry<typeof file\d+>;\s+"todos": DiscoveredConfigEntry<typeof file\d+>;\s+\}/,
      /interface LegacySlotMap \{ "sidebar\.top": true; \}/,
      /interface ActionMapOptions \{ strict: true \}/,
    ])
      assert.match(source, declaration);
    assert.match(source, /type DiscoveredEvents = DiscoveredEventsEntry<typeof file\d+, "todos">/);
    assert.match(
      source,
      /type DiscoveredCancelable = DiscoveredCancelableEntry<typeof file\d+, "todos">/,
    );
    assert.match(
      source,
      /type DiscoveredServices = DiscoveredServiceEntry<typeof file\d+, "todos"> & DiscoveredServiceEntry<typeof file\d+, "todos">/,
    );
    assert.match(
      source,
      /DiscoveredActionEntry<typeof file\d+, "">/,
      'app actions have no module prefix',
    );
    assert.match(
      source,
      /import \* as module\d+ from '\.\/plugins\/todos\/ui\/pages\/tasks\/\[id\]';/,
    );
    assert.match(
      source,
      /pluginPage\(module\d+, "\/todos"\), pluginPage\(module\d+, "\/todos\/tasks\/\[id\]"\)/,
    );
    assert.match(
      source,
      /pluginSlot\(module\d+, "sidebar\.top", "src\/plugins\/todos\/ui\/slots\/sidebar\.top\.tsx"\)/,
    );
    assert.match(source, /pluginProvider\(module\d+, "todos\.query"\)/);
    assert.match(source, /events: discoverEvents\(\[file\d+\]\)/);
    assert.match(source, /discoveredFile\(entry\d+, "", "src\/plugins\/todos\/events\.ts"\)/);
    assert.match(source, /settings: discoverSettings\(\[file\d+\]\)/);
    assert.match(source, /settings: pluginSettingsPage\(module\d+\)/);
    assert.match(source, /DiscoveredSettingsEntry<typeof file\d+, "">/);
    assert.match(source, /DiscoveredSettingsEntry<typeof file\d+, "todos">/);
    assert.match(source, /id: "todos", metadata: \{"name":"Todos"\}, dependencies: \[\]/);
    assert.match(
      source,
      /const configOverrides: Record<string, Record<string, unknown>> = \{"todos":\{"limits":\{"maxItems":5\}\}\};/,
    );
    assert.doesNotMatch(
      source,
      /components\/button|\.foundation|publicServices|discoverPublicServices/,
    );

    const consumer = await put(
      'consumer.ts',
      `
      import type { BitaKitRuntime, Services, Events } from '@bitakit/core';
      import type { BitaKitConfig } from './src/bitakit.gen';
      declare const runtime: BitaKitRuntime;
      declare const services: Services;
      declare const events: Events;
      declare const config: BitaKitConfig;
      const app = runtime.app;
      const count: number = app.services.todos.items.count();
      const added: string = services.todos.items.add('x');
      const now: Date = app.services.clock.now();
      const same: Date = services.todos.clock.now();
      const max: number = app.config.todos.limits.maxItems;
      const title: string = app.config.app.shell.title;
      const size: number = app.settings.todos.pageSize.get();
      app.settings.theme.set('dark');
      // @ts-expect-error Setting values follow settings.ts.
      app.settings.theme.set('blue');
      // @ts-expect-error Unknown settings are not part of completion.
      app.settings.todos.unknown;
      app.actions.todos.add.execute('title').then((outcome) => {
        if (outcome.status === 'completed') { const value: string = outcome.value; void value; }
      });
      // @ts-expect-error Action inputs stay typed after discovery.
      app.actions.todos.add.execute(42);
      runtime.actions.execute('todos.clear');
      runtime.actions.execute('refresh');
      // @ts-expect-error Strict action IDs reject unknown actions.
      runtime.actions.execute('todos.unknown');
      events.emit('todos.changed', { kind: 'added' });
      // @ts-expect-error Payloads follow events.ts.
      events.emit('todos.changed', { kind: 'other' });
      const allowed: Promise<boolean> = events.emit('todos.deleting', { id: 1 });
      // @ts-expect-error Only cancelable events return a promise.
      const wrong: Promise<boolean> = events.emit('todos.changed', { kind: 'added' });
      events.on('todos.*', (event) => { const type: 'todos.changed' | 'todos.deleting' = event.type; void type; });
      // @ts-expect-error Services form a tree, never flat keys.
      services['todos.items'];
      // @ts-expect-error app.optional is gone; read services after ready.
      app.optional;
      // @ts-expect-error Unknown services are not part of completion.
      app.services.documents;
      const ids: string[] = config.plugins.map((plugin) => plugin.id);
      void [count, added, now, same, max, title, size, allowed, wrong, ids];
    `,
    );
    assert.deepEqual(typeErrors([result.generated, consumer], root), []);

    const { createBitaKitConfig } = await loadGenerated(result.generated);
    const config = createBitaKitConfig();
    assert.equal(config.appId, 'app');
    assert.deepEqual(
      config.plugins.map((plugin) => plugin.id),
      ['todos'],
    );
    const [todos] = config.plugins;
    assert.deepEqual(todos.metadata, { name: 'Todos' });
    assert.equal(todos.settings.settings.pageSize.default, 20);
    assert.deepEqual(todos.settings.section, { title: 'Todos' });
    assert.equal(typeof todos.ui.settings.component, 'function');
    assert.equal(config.settings.settings.theme.default, 'system');
    assert.deepEqual(
      todos.ui.pages.map(({ path: pagePath, layout }) => ({ path: pagePath, layout })),
      [
        { path: '/todos', layout: undefined },
        { path: '/todos/tasks/[id]', layout: 'blank' },
      ],
    );
    assert.deepEqual(
      todos.ui.slots.map(({ slot, order }) => ({ slot, order })),
      [{ slot: 'sidebar.top', order: 5 }],
    );
    assert.deepEqual(
      todos.ui.providers.map(({ id, requires }) => ({ id, requires })),
      [{ id: 'todos.query', requires: ['theme'] }],
    );
    assert.equal(typeof todos.ui.pages[0].component, 'function');

    const runtime = createRuntime(config);
    const stop = runtime.mount();
    await runtime.ready;
    const items = runtime.services.todos.items;
    try {
      assert.deepEqual(Object.keys(runtime.services.todos).sort(), ['clock', 'items']);
      assert.equal(
        runtime.services.clock,
        runtime.services.todos.clock,
        'exposeAs adds an alias onto the same instance',
      );
      assert.ok(runtime.app.services.clock.now() instanceof Date);
      assert.throws(
        () => runtime.services['todos.items'],
        BitaKitServiceError,
        'services are a tree, never flat keys',
      );
      assert.equal(runtime.actions.get('todos.clear').enabled, false);
      const changes = [];
      runtime.events.on('todos.changed', (event) => changes.push(event.data));
      assert.deepEqual(await runtime.actions.execute('todos.add', 'Write tests'), {
        status: 'completed',
        value: 'Write tests',
      });
      assert.deepEqual(changes, [{ kind: 'added' }]);
      assert.equal(
        runtime.actions.get('todos.clear').enabled,
        true,
        'function-valued enabled follows the store',
      );
      assert.equal(runtime.app.services.todos.items.count(), 1);
      runtime.events.on('todos.deleting', (event) => event.cancel());
      assert.equal(
        await runtime.events.emit('todos.deleting', { id: 1 }),
        false,
        'cancelable events report cancellation',
      );
      assert.equal(
        runtime.app.config.todos.limits.maxItems,
        5,
        'bitakit.config.ts overrides apply',
      );
      assert.deepEqual(runtime.app.config.app, { shell: { title: 'Demo' } });
      assert.equal((await runtime.actions.execute('refresh')).value, 'Demo');
      assert.deepEqual(
        items.audit,
        ['setup', 'todos.add'],
        'plugin interceptors see their own actions only',
      );
      const page = findPluginPage(runtime.modules, '/todos/tasks/42');
      assert.equal(page.plugin, 'todos');
      assert.deepEqual(page.params, { id: '42' });
      assert.equal(page.layout, 'blank');
      assert.equal(findPluginPage(runtime.modules, '/todos').path, '/todos');
      assert.equal(findPluginPage(runtime.modules, '/missing'), undefined);
    } finally {
      await stop();
    }
    assert.deepEqual(items.audit.at(-1), 'cleanup');
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, 'src/bitakit.gen.messages.json'), 'utf8')),
      {
        en: { todos: { add: { title: 'Add item' } } },
      },
    );
    const css = await readFile(path.join(root, 'src/bitakit.gen.css'), 'utf8');
    assert.match(css, /Generated by BitaKit/);
    assert.doesNotMatch(css, /@import/);
  }));

test('framework detection chooses the provider import and the file extension; a stale file is removed', async () =>
  fixture(async (root, put) => {
    assert.equal(detectFramework({ dependencies: { next: '15.0.0' } }), 'next');
    assert.equal(
      detectFramework({ devDependencies: { '@tanstack/react-router': '1.0.0' } }),
      'tanstack',
    );
    assert.equal(
      detectFramework({ dependencies: { '@tanstack/react-start': '1.0.0' } }),
      'tanstack',
    );
    assert.equal(detectFramework({}), 'none');
    await put('src/actions/ping.ts', 'export default { execute: () => "pong" }');
    const files = async () =>
      (await readdir(path.join(root, 'src')))
        .filter((name) => name.startsWith('bitakit.gen.'))
        .sort();

    await put(
      'package.json',
      JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } }),
    );
    const next = await generateBitaKit(root, { quiet: true });
    assert.equal(next.framework, 'next');
    assert.equal(next.generated, path.join(root, 'src/bitakit.gen.tsx'));
    const nextSource = await readFile(next.generated, 'utf8');
    assert.match(nextSource, /^\/\/ Generated by BitaKit\. Do not edit\.\n'use client';\n/);
    assert.match(nextSource, /import \{ BitaKitRuntimeProvider \} from '@bitakit\/next';/);
    assert.match(nextSource, /import \{ useMemo, type ComponentProps \} from 'react';/);
    assert.match(nextSource, /import \{ createBitaKitConfig \} from '\.\/bitakit\.gen\.config';/);
    assert.match(nextSource, /export type \{ BitaKitConfig \} from '\.\/bitakit\.gen\.config';/);
    assert.doesNotMatch(nextSource, /export function createBitaKitConfig\(\)/);
    assert.match(
      nextSource,
      /export function BitaKitProvider\(props: Omit<ComponentProps<typeof BitaKitRuntimeProvider>, 'config'>\)/,
    );
    assert.match(nextSource, /<BitaKitRuntimeProvider \{\.\.\.props\} config=\{config\} \/>/);
    const nextConfigPath = path.join(root, 'src/bitakit.gen.config.ts');
    const nextConfig = await readFile(nextConfigPath, 'utf8');
    assert.match(nextConfig, /^\/\/ Generated by BitaKit\. Do not edit\./);
    assert.match(nextConfig, /export function createBitaKitConfig\(\)/);
    assert.match(nextConfig, /export type BitaKitConfig = ReturnType<typeof createBitaKitConfig>/);
    assert.match(nextConfig, /^\/\/ Generated by BitaKit\. Do not edit\.\n'use client';/);
    assert.doesNotMatch(nextConfig, /BitaKitProvider|@bitakit\/next/);
    assert.deepEqual(await files(), [
      'bitakit.gen.config.ts',
      'bitakit.gen.css',
      'bitakit.gen.tsx',
    ]);
    assert.equal(
      (await files()).some((name) => name.endsWith('.tmp')),
      false,
    );

    await put(
      'package.json',
      JSON.stringify({ dependencies: { '@tanstack/react-start': '1.0.0' } }),
    );
    const tanstack = await generateBitaKit(root, { quiet: true });
    assert.equal(tanstack.framework, 'tanstack');
    assert.match(
      await readFile(tanstack.generated, 'utf8'),
      /import \{ BitaKitRuntimeProvider \} from '@bitakit\/tanstack';/,
    );

    await put('package.json', JSON.stringify({ dependencies: {} }));
    const plain = await generateBitaKit(root, { quiet: true });
    assert.equal(plain.framework, 'none');
    assert.equal(plain.generated, path.join(root, 'src/bitakit.gen.ts'));
    assert.deepEqual(
      await files(),
      ['bitakit.gen.css', 'bitakit.gen.ts'],
      'the .tsx provider and separate config are removed',
    );
    const plainSource = await readFile(plain.generated, 'utf8');
    assert.doesNotMatch(plainSource, /use client|BitaKitProvider|react/);
    assert.equal(await exists(path.join(root, 'src/bitakit.gen.config.ts')), false);
    assert.deepEqual(
      typeErrors([plain.generated], root),
      [],
      'an app without plugins still type-checks',
    );

    await put('package.json', JSON.stringify({ dependencies: { next: '15.0.0' } }));
    await put('bitakit.config.ts', `export default { framework: 'none' };`);
    const forced = await generateBitaKit(root, { quiet: true });
    assert.equal(forced.framework, 'none');
    assert.deepEqual(
      await files(),
      ['bitakit.gen.css', 'bitakit.gen.ts'],
      'an explicit framework wins over detection',
    );
  }));

test('configuration options shape the generated declarations and output location', async () =>
  fixture(async (root, put) => {
    await put(
      'bitakit.config.ts',
      `export default { directory: './app', strict: false, slots: ['sidebar.top', 'sidebar.top', 'app-bar.end'], groups: ['navigation'] };`,
    );
    await put('app/actions/ping.ts', 'export default { execute: () => "pong" }');
    const result = await generateBitaKit(root, { quiet: true });
    assert.equal(result.generated, path.join(root, 'app/bitakit.gen.ts'));
    assert.ok(await exists(path.join(root, 'app/bitakit.gen.css')));
    assert.equal(await exists(path.join(root, 'src')), false);
    const source = await readFile(result.generated, 'utf8');
    assert.doesNotMatch(
      source,
      /ActionMapOptions/,
      'strict: false keeps unknown action IDs allowed',
    );
    assert.match(
      source,
      /interface LegacySlotMap \{ "sidebar\.top": true; "app-bar\.end": true; \}/,
      'slot names are deduplicated',
    );
    assert.match(source, /groups: \["navigation"\]/);
    const consumer = await put(
      'consumer.ts',
      `
      import type { BitaKitRuntime } from '@bitakit/core';
      declare const runtime: BitaKitRuntime;
      runtime.actions.execute('anything.goes');
    `,
    );
    assert.deepEqual(typeErrors([result.generated, consumer], root), []);
  }));

test('legacy folders and suffixes are discovered with migration warnings; helpers without a default export are skipped', async () =>
  fixture(async (root, put) => {
    await put('src/providers/legacy.tsx', 'export default () => null;');
    await put('src/plugins/todos/pages/legacy.tsx', 'export default () => null;');
    await put('src/plugins/todos/views/panel.view.tsx', 'export default () => null;');
    await put(
      'src/plugins/todos/actions/clear.action.ts',
      'export default { execute: () => "cleared" }',
    );
    await put(
      'src/plugins/todos/services/log.service.ts',
      'export default () => ({ write: () => "logged" })',
    );
    await put('src/plugins/todos/actions/util.ts', 'export const helper = 1;');
    await put('src/plugins/todos/actions/-draft.ts', 'export default { execute: () => "draft" }');
    await put(
      'src/plugins/todos/server/secret.ts',
      'throw new Error("server code"); export default { execute: () => "secret" }',
    );
    await put('src/plugins/todos/ui/components/button.tsx', 'export default () => null;');
    const result = await generateBitaKit(root, { quiet: true });
    expectWarnings(result.warnings, [
      /^src\/plugins\/todos\/pages\/legacy\.tsx: move it under ui\/pages\/; the old location is deprecated/,
      /^src\/plugins\/todos\/views\/panel\.view\.tsx: move it under ui\/slots\/; the old location is deprecated/,
      /^src\/plugins\/todos\/views\/panel\.view\.tsx: drop the "\.view" suffix; folders are the one convention \(run "bitakit migrate"\)\.$/,
      /^src\/plugins\/todos\/actions\/clear\.action\.ts: drop the "\.action" suffix; folders are the one convention/,
      /^src\/plugins\/todos\/services\/log\.service\.ts: drop the "\.service" suffix; folders are the one convention/,
      /^src\/plugins\/todos\/actions\/util\.ts is in a actions folder but has no default export, so it is ignored\. Export the contribution as default, or prefix the file name with "-" for helpers\.$/,
    ]);
    const source = await readFile(result.generated, 'utf8');
    assert.doesNotMatch(source, /util|draft|secret|components\/button/);
    assert.match(source, /pluginPage\(module\d+, "\/todos\/legacy"\)/);
    assert.match(
      source,
      /pluginSlot\(module\d+, "panel", "src\/plugins\/todos\/views\/panel\.view\.tsx"\)/,
    );
    assert.match(
      source,
      /ui: \{ pages: \[\], slots: \[\], providers: \[\] \}/,
      'the legacy app providers folder needs providers.enabled',
    );
    const { createBitaKitConfig } = await loadGenerated(result.generated);
    const runtime = createRuntime(createBitaKitConfig());
    const stop = runtime.mount();
    try {
      assert.equal((await runtime.actions.execute('todos.clear')).value, 'cleared');
      assert.equal(runtime.services.todos.log.write(), 'logged');
    } finally {
      await stop();
    }
  }));

test('discoverEntries treats folders, dots and index files alike, reports legacy spellings and rejects duplicates', async () =>
  fixture(async (root, put) => {
    for (const kind of ['actions', 'services', 'interceptors', 'configs']) {
      for (const name of [
        `${kind}.team.refresh.ts`,
        `${kind}/team/refresh.ts`,
        `${kind}/team.refresh.ts`,
      ]) {
        const source = await put(name, 'export default {}');
        const { entries, warnings } = await discoverEntries(root, [source], kind);
        assert.deepEqual(
          entries.map((entry) => entry.path),
          [['team', 'refresh']],
        );
        assert.deepEqual(warnings, []);
      }
      await assert.rejects(
        discoverEntries(
          root,
          [path.join(root, `${kind}.team.refresh.ts`), path.join(root, `${kind}/team/refresh.ts`)],
          kind,
        ),
        /Duplicate.*team\.refresh/,
      );
    }
    const collection = await put('actions/index.ts', 'export default {}');
    const nested = await put('actions/team/index.ts', 'export default {}');
    const legacyIndex = await put('actions/index.action.ts', 'export default {}');
    const page = await put('ui/pages/tasks/[id].tsx', 'export default () => null');
    const legacyPage = await put('pages/home.page.tsx', 'export default () => null');
    const helper = await put('actions/-helper.ts', 'export default {}');
    const named = await put(
      'actions/named.ts',
      'export const action = {}; export { action as default };',
    );
    const skipped = await put('actions/skipped.ts', 'export const nothing = 1;');
    const typed = await put('actions/types.d.ts', 'export default {}');
    const server = await put('server/handler.ts', 'export default {}');
    const actions = await discoverEntries(
      root,
      [collection, nested, legacyIndex, helper, named, skipped, typed, server],
      'actions',
    );
    assert.deepEqual(
      actions.entries.map((entry) => entry.path),
      [[], ['team'], ['index'], ['named']],
    );
    assert.deepEqual(
      actions.entries.map((entry) => entry.source),
      ['actions/index.ts', 'actions/team/index.ts', 'actions/index.action.ts', 'actions/named.ts'],
    );
    expectWarnings(actions.warnings, [
      /^actions\/index\.action\.ts: drop the "\.action" suffix/,
      /^actions\/skipped\.ts is in a actions folder but has no default export/,
    ]);
    const pages = await discoverEntries(root, [page, legacyPage], 'pages');
    assert.deepEqual(
      pages.entries.map((entry) => entry.path),
      [['tasks', '[id]'], ['home']],
    );
    expectWarnings(pages.warnings, [
      /^pages\/home\.page\.tsx: move it under ui\/pages\//,
      /^pages\/home\.page\.tsx: drop the "\.page" suffix/,
    ]);
    const shown = await discoverEntries(root, [skipped], 'actions', {
      relativeTo: path.dirname(root),
    });
    assert.match(shown.warnings[0], new RegExp(`^${path.basename(root)}/actions/skipped\\.ts`));
    await assert.rejects(
      discoverEntries(root, [collection], 'widgets'),
      /Unknown contribution kind/,
    );
  }));

test('plugin roots, IDs, inclusion and overrides follow bitakit.config.ts', async () =>
  fixture(async (root, put) => {
    await put(
      'bitakit.config.ts',
      `export default {
      plugins: { directory: 'src/extensions', include: { notes: './shared/notes' }, overrides: { off: { enabled: false } } },
      configOverrides: { off: { size: 1 }, library: { size: 2 } },
    };`,
    );
    await put('src/extensions/documents/plugin.config.ts', `export default { id: 'library' };`);
    await put(
      'src/extensions/documents/services/documents.ts',
      `
      import { defineService } from '@bitakit/core';
      export default defineService(() => ({ read: () => 42 }), { id: 'archive' });
    `,
    );
    await put(
      'src/extensions/documents/actions/create.ts',
      `
      import { defineAction } from '@bitakit/core';
      export default defineAction({ id: 'archive.open', execute: ({ services, config }) => services.archive.read() + config.plugin.get('size', 0) });
    `,
    );
    await put('src/extensions/off/actions/never.ts', 'export default { execute: () => "off" }');
    await put('shared/notes/actions/list.ts', 'export default { execute: () => "notes" }');
    await put(
      'shared/notes/package.json',
      JSON.stringify({ name: '@acme/notes', version: '1.2.3', description: 'Shared notes' }),
    );
    await put(
      'shared/notes/plugin.config.ts',
      `export default { metadata: { tags: ['productivity'], coverImage: '/notes.png' } };`,
    );
    const result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result.included, [path.join(root, 'shared/notes')]);
    const { createBitaKitConfig } = await loadGenerated(result.generated);
    const config = createBitaKitConfig();
    assert.deepEqual(
      config.plugins.map((plugin) => plugin.id),
      ['library', 'notes'],
    );
    assert.deepEqual(config.plugins[1].metadata, {
      name: '@acme/notes',
      version: '1.2.3',
      description: 'Shared notes',
      tags: ['productivity'],
      coverImage: '/notes.png',
    });
    assert.deepEqual(
      config.configOverrides,
      { library: { size: 2 } },
      'overrides of disabled plugins are dropped',
    );
    const runtime = createRuntime(config);
    const stop = runtime.mount();
    try {
      assert.equal((await runtime.actions.execute('archive.open')).value, 44);
      assert.equal(runtime.services.archive.read(), 42);
      assert.equal((await runtime.actions.execute('notes.list')).value, 'notes');
      assert.equal(runtime.actions.get('off.never'), undefined);
    } finally {
      await stop();
    }

    await put(
      'bitakit.config.ts',
      `export default { plugins: { directory: 'src/extensions', autoEnable: false, overrides: { library: { enabled: true } } } };`,
    );
    const selected = createRuntime(
      (
        await loadGenerated((await generateBitaKit(root, { quiet: true })).generated)
      ).createBitaKitConfig(),
    );
    assert.deepEqual(
      selected.config.plugins.map((plugin) => plugin.id),
      ['library'],
      'autoEnable: false enables plugins one by one',
    );

    await put(
      'bitakit.config.ts',
      `export default { plugins: { directory: 'src/extensions', include: { 'Bad Id': './shared/notes' } } };`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /Invalid included plugin ID "Bad Id"/,
    );
    await put('bitakit.config.ts', `export default { plugins: { directory: 'src/extensions' } };`);
    await put('src/extensions/Todos/actions/add.ts', 'export default { execute: () => 1 }');
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /Invalid plugin ID "Todos" \(src\/extensions\/Todos\)/,
    );
    await rm(path.join(root, 'src/extensions/Todos'), { recursive: true });
    await put('src/extensions/off/plugin.config.ts', `export default { id: 'library' };`);
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /Plugin ID "library" is used twice \(src\/extensions\/off\)/,
    );
  }));

test('the app module namespaces its contributions, declares events and selects interceptors and providers', async () =>
  fixture(async (root, put) => {
    await put(
      'bitakit.config.ts',
      `export default { interceptors: { enabled: ['organization', 'logger'] }, providers: { enabled: ['theme', 'query'] } };`,
    );
    await put(
      'src/plugin.config.ts',
      `export default { id: 'app', dependencies: ['shell'], metadata: { name: 'Demo app' } };`,
    );
    await put(
      'src/actions/refresh.ts',
      'export default { execute: ({ config }) => config.action.get("size") }',
    );
    await put(
      'src/actions/start.ts',
      'export default { execute: ({ events }) => { events.emit("app.started"); return "started"; } }',
    );
    await put('src/configs/actions/refresh.ts', 'export default { size: 3 }');
    await put(
      'src/services/logging.ts',
      'export default () => ({ marks: [] as string[], log: () => 1 })',
    );
    await put(
      'src/events.ts',
      `
      import { defineEvents, event } from '@bitakit/core';
      export default defineEvents({ started: event() });
    `,
    );
    await put(
      'src/setup.ts',
      'export default ({ services }) => { services.app.logging.marks.push("setup"); }',
    );
    for (const name of ['logger', 'organization', 'unused'])
      await put(
        `src/interceptors/${name}.ts`,
        `export default { before: ({ services }) => { services.app.logging.marks.push(${JSON.stringify(name)}); } }`,
      );
    await put('src/providers/legacy.tsx', 'export default () => null;');
    await put('src/providers/theme.tsx', 'export default () => null;');
    await put('src/ui/providers/query.tsx', 'export default () => null;');
    await put('src/plugins/shell/setup.ts', 'export default () => {};');
    const result = await generateBitaKit(root, { quiet: true });
    expectWarnings(result.warnings, [
      /^src\/providers\/legacy\.tsx: move it under ui\/providers\//,
      /^src\/providers\/theme\.tsx: move it under ui\/providers\//,
    ]);
    const source = await readFile(result.generated, 'utf8');
    assert.match(
      source,
      /appId: "app",\s+\.\.\.\{"knownBundles":\[\]\},\s+metadata: \{"name":"Demo app"\},\s+dependencies: \["shell"\],/,
    );
    assert.match(
      source,
      /events: discoverEvents\(\[file\d+\]\),\s+settings: discoverSettings\(\[\]\),\s+services: discoverServices\(\[file\d+\], "app"\),\s+slots: discoverSlots\(\[\], ""\),\s+actions: discoverActions\(\[file\d+, file\d+\], "app"\)/,
    );
    assert.match(source, /type DiscoveredEvents = DiscoveredEventsEntry<typeof file\d+, "app">/);
    assert.match(
      source,
      /providers: \[pluginProvider\(module\d+, "theme"\), pluginProvider\(module\d+, "query"\)\]/,
    );
    assert.doesNotMatch(source, /unused|legacy/);
    const { createBitaKitConfig } = await loadGenerated(result.generated);
    const runtime = createRuntime(createBitaKitConfig());
    const stop = runtime.mount();
    try {
      const started = [];
      runtime.events.on('app.started', (event) => started.push(event.type));
      assert.equal((await runtime.actions.execute('app.refresh')).value, 3);
      assert.equal((await runtime.actions.execute('app.start')).value, 'started');
      assert.deepEqual(started, ['app.started']);
      assert.equal(runtime.services.app.logging.log(), 1);
      assert.deepEqual(
        runtime.services.app.logging.marks,
        ['setup', 'organization', 'logger', 'organization', 'logger'],
        'interceptors.enabled selects and orders',
      );
      assert.deepEqual(runtime.app.config.app, { actions: { refresh: { size: 3 } } });
    } finally {
      await stop();
    }
    await put('bitakit.config.ts', `export default { interceptors: { enabled: ['nope'] } };`);
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /interceptors\.enabled names "nope", but no interceptor file with that name exists/,
    );
    await put(
      'bitakit.config.ts',
      `export default { providers: { enabled: ['theme', 'theme'] } };`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /listed twice in providers\.enabled/,
    );
  }));

test('generation never executes contributions, removes the previous generated layout and validates locales', async () =>
  fixture(async (root, put) => {
    await put(
      'src/plugins/content/actions/never.ts',
      'throw new Error("must not execute during discovery"); export default { execute: () => 1 }',
    );
    await put(
      'src/plugins/content/locales/de.json',
      JSON.stringify({ content: { never: { title: 'Nie' } } }),
    );
    await put('.foundation/plugins.ts', '// Generated by Foundation\nexport const plugins = [];');
    await put('.foundation/app.ts', '// Generated by Foundation\nexport const app = {};');
    await put('.foundation/styles.css', '/* Generated by Foundation */');
    await put('.foundation/messages.json', '{}');
    await put('foundation-env.d.ts', '// Generated by Foundation');
    const result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      await exists(path.join(root, '.foundation')),
      false,
      'the empty legacy folder is removed',
    );
    assert.equal(await exists(path.join(root, 'foundation-env.d.ts')), false);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, 'src/bitakit.gen.messages.json'), 'utf8')),
      { de: { content: { never: { title: 'Nie' } } } },
    );

    await put('.foundation/plugins.ts', '// Generated by Foundation');
    await put('.foundation/custom.ts', 'export const handWritten = true;');
    await rm(path.join(root, 'src/plugins/content/locales'), { recursive: true });
    await generateBitaKit(root, { quiet: true });
    assert.deepEqual(
      await readdir(path.join(root, '.foundation')),
      ['custom.ts'],
      'only generated files are deleted',
    );
    assert.equal(
      await exists(path.join(root, 'src/bitakit.gen.messages.json')),
      false,
      'the messages file disappears with the last locale',
    );

    await put(
      'src/plugins/content/locales/en.json',
      JSON.stringify({ other: { title: 'Wrong namespace' } }),
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /src\/plugins\/content\/locales\/en\.json: locale keys must sit under the plugin namespace "content"/,
    );
  }));

test('services are nested per plugin, so equal file names never collide; exposeAs adds a deliberate alias', async () =>
  fixture(async (root, put) => {
    await put(
      'src/plugins/notes/services/store.ts',
      `
      import { defineService } from '@bitakit/core';
      export default defineService(() => ({ read: () => 'notes' }));
    `,
    );
    await put(
      'src/plugins/todos/services/store.ts',
      `
      import { defineService } from '@bitakit/core';
      export default defineService(() => ({ add: (title: string) => \`todos:\${title}\` }), { exposeAs: 'todoStore' });
    `,
    );
    await put(
      'src/plugins/todos/actions/inspect.ts',
      `
      import { defineAction } from '@bitakit/core';
      export default defineAction({
        requires: ['notes.store', 'todoStore'],
        execute: ({ services }) => [services.notes.store.read(), services.todos.store.add('tree'), services.todoStore.add('alias')],
      });
    `,
    );
    const result = await generateBitaKit(root, { quiet: true });
    const consumer = await put(
      'consumer.ts',
      `
      import type { Services } from '@bitakit/core';
      declare const services: Services;
      const notes: string = services.notes.store.read();
      const todo: string = services.todos.store.add('typed');
      // @ts-expect-error The notes store does not gain the methods of the todos store.
      services.notes.store.add('x');
      // @ts-expect-error The todos store does not gain the methods of the notes store.
      services.todos.store.read();
      void [notes, todo];
    `,
    );
    assert.deepEqual(typeErrors([result.generated, consumer], root), []);
    const runtime = createRuntime((await loadGenerated(result.generated)).createBitaKitConfig());
    const stop = runtime.mount();
    try {
      assert.deepEqual((await runtime.actions.execute('todos.inspect')).value, [
        'notes',
        'todos:tree',
        'todos:alias',
      ]);
      assert.equal(runtime.services.todoStore, runtime.services.todos.store);
    } finally {
      await stop();
    }
    await put(
      'src/plugins/notes/services/alias.ts',
      `
      import { defineService } from '@bitakit/core';
      export default defineService(() => ({}), { exposeAs: 'todoStore' });
    `,
    );
    const clashing = (
      await loadGenerated((await generateBitaKit(root, { quiet: true })).generated)
    ).createBitaKitConfig();
    assert.throws(
      () => createRuntime(clashing),
      /Two services are named "todoStore" \(notes\.alias and todos\.store\)/,
    );
  }));

test('describeBitaKit and describeModule summarize modules, packages and warnings without executing anything', async () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ dependencies: { '@acme/shell': '1.0.0' } }));
    await put(
      'node_modules/@acme/shell/package.json',
      JSON.stringify({
        name: '@acme/shell',
        exports: {
          './package.json': './package.json',
          './plugin': './plugin.js',
          './styles.css': './styles.css',
        },
        bitakit: { plugin: './plugin', styles: './styles.css' },
      }),
    );
    await put('node_modules/@acme/shell/styles.css', '/* fixture */');
    await put(
      'bitakit.config.ts',
      `export default { plugins: { overrides: { todos: { enabled: false } } } };`,
    );
    await put('src/actions/refresh.ts', 'export default { execute: () => 1 }');
    await put('src/services/logging.ts', 'export default () => ({})');
    await put('src/events.ts', 'export default {}');
    await put('src/configs/shell.ts', 'export default {}');
    await put('src/interceptors/log.ts', 'export default { before: () => {} }');
    await put('src/ui/pages/index.tsx', 'export default () => null;');
    await put('src/ui/slots/sidebar.top.tsx', 'export default () => null;');
    await put('src/ui/providers/query.tsx', 'export default () => null;');
    await put('src/plugins/todos/plugin.config.ts', `export default { dependencies: ['shell'] };`);
    await put(
      'src/plugins/todos/actions/add.ts',
      'throw new Error("never executed"); export default { execute: () => 1 }',
    );
    await put('src/plugins/todos/actions/clear.action.ts', 'export default { execute: () => 1 }');
    await put('src/plugins/todos/ui/pages/tasks/[id].tsx', 'export default () => null;');
    await put('src/plugins/todos/setup.ts', 'export default () => {}');
    await put('src/plugins/todos/locales/en.json', '{}');
    const description = await describeBitaKit(root);
    assert.deepEqual(Object.keys(description), [
      'root',
      'knownBundles',
      'packagePlugins',
      'framework',
      'pluginsDirectory',
      'appDirectory',
      'app',
      'plugins',
      'packages',
      'catalogPackages',
      'installedPackages',
      'styles',
      'slotDeclarations',
      'unresolvedSlots',
      'slots',
      'choose',
      'warnings',
      'metadataWarnings',
      'packageWarnings',
    ]);
    assert.equal(description.root, root);
    assert.deepEqual(description.choose, {});
    assert.equal(description.framework, 'none');
    assert.equal(description.pluginsDirectory, 'src/plugins');
    assert.equal(description.appDirectory, 'src');
    assert.deepEqual(description.app, {
      id: 'app',
      directory: 'src',
      origin: { kind: 'local', package: null, memberOf: null },
      metadata: {},
      actions: [{ path: 'refresh', file: 'src/actions/refresh.ts' }],
      services: [{ path: 'logging', file: 'src/services/logging.ts' }],
      pages: [{ path: '', file: 'src/ui/pages/index.tsx' }],
      slots: [{ path: 'sidebar.top', file: 'src/ui/slots/sidebar.top.tsx' }],
      slotDefinitions: [],
      providers: [{ path: 'query', file: 'src/ui/providers/query.tsx' }],
      configs: [{ path: 'shell', file: 'src/configs/shell.ts' }],
      interceptors: [{ path: 'log', file: 'src/interceptors/log.ts' }],
      events: [{ path: '', file: 'src/events.ts' }],
      settings: [],
      layouts: [],
    });
    assert.deepEqual(description.plugins, [
      {
        id: 'todos',
        directory: 'src/plugins/todos',
        origin: { kind: 'local', package: null, memberOf: null },
        metadata: {},
        dependencies: ['shell'],
        enabled: false,
        actions: [
          { path: 'add', file: 'src/plugins/todos/actions/add.ts' },
          { path: 'clear', file: 'src/plugins/todos/actions/clear.action.ts' },
        ],
        services: [],
        pages: [{ path: 'tasks.[id]', file: 'src/plugins/todos/ui/pages/tasks/[id].tsx' }],
        slots: [],
        slotDefinitions: [],
        providers: [],
        configs: [],
        interceptors: [],
        events: [],
        settings: [],
      },
    ]);
    assert.deepEqual(description.packages, ['@acme/shell/plugin']);
    assert.deepEqual(description.catalogPackages, []);
    assert.deepEqual(description.slots, []);
    assert.deepEqual(description.installedPackages, ['@acme/shell']);
    assert.deepEqual(description.styles, ['@acme/shell/styles.css']);
    expectWarnings(description.warnings, [
      /^src\/plugins\/todos\/actions\/clear\.action\.ts: drop the "\.action" suffix/,
    ]);

    const module = await describeModule(path.join(root, 'src/plugins/todos'));
    assert.deepEqual(Object.keys(module).sort(), [
      'actions',
      'configs',
      'directory',
      'events',
      'interceptors',
      'locales',
      'pages',
      'providers',
      'services',
      'settings',
      'setup',
      'slotDefinitions',
      'slots',
      'warnings',
    ]);
    assert.equal(module.directory, path.join(root, 'src/plugins/todos'));
    assert.deepEqual(
      module.actions.map((entry) => entry.path),
      ['add', 'clear'],
    );
    assert.equal(module.actions[0].file, path.join(root, 'src/plugins/todos/actions/add.ts'));
    assert.equal(module.setup, path.join(root, 'src/plugins/todos/setup.ts'));
    assert.deepEqual(module.locales, [path.join(root, 'src/plugins/todos/locales/en.json')]);
    expectWarnings(module.warnings, [/^actions\/clear\.action\.ts: drop the "\.action" suffix/]);
    assert.equal((await describeModule(path.join(root, 'src'))).setup, undefined);
  }));

test('migrateProject rewrites the 0.1 layout; a dry run only reports the same changes', async () =>
  fixture(async (root, put) => {
    await put(
      'package.json',
      JSON.stringify(
        { name: 'legacy', scripts: { dev: 'foundation-generate && next dev --webpack' } },
        null,
        2,
      ),
    );
    // The rewritten config imports @bitakit/discovery; a stub stands in for the installed package.
    await put(
      'node_modules/@bitakit/discovery/package.json',
      JSON.stringify({ name: '@bitakit/discovery', exports: { '.': './index.mjs' } }),
    );
    await put(
      'node_modules/@bitakit/discovery/index.mjs',
      'export const defineBitaKit = (config) => config;',
    );
    await put('.gitignore', 'node_modules/\n.foundation/\nfoundation-env.d.ts\n');
    await put(
      'foundation.config.ts',
      "import { defineFoundation } from '@bitakit/next/config';\nexport default defineFoundation({});\n",
    );
    await put('src/actions.refresh.ts', 'export default { execute: () => 1 }');
    await put('src/actions/save.action.ts', 'export default { execute: () => 1 }');
    await put('src/services.logging.ts', 'export default () => ({})');
    await put('src/configs.actions.refresh.ts', 'export default { pageSize: 7 }');
    await put('src/pages/home.page.tsx', 'export default () => null');
    await put('src/views/workspace.view.tsx', 'export default () => null');
    await put(
      'src/app/layout.tsx',
      "import '../../.foundation/styles.css';\nimport { foundationConfig } from '../../.foundation/plugins';\nimport { defineURLAction } from '@bitakit/core';\n",
    );
    await put('src/plugins/todos/actions/add.action.ts', 'export default { execute: () => 1 }');
    // One file per kind is a supported layout, not a legacy spelling: it stays in place.
    await put('src/plugins/todos/services.ts', 'export default { items: () => ({}) }');
    await put('src/plugins/todos/pages/index.tsx', 'export default () => null');
    await put('src/plugins/todos/views/app-bar.end.view.tsx', 'export default () => null');
    await put('.foundation/plugins.ts', '// Generated by Foundation');
    await put('foundation-env.d.ts', '// Generated by Foundation');
    const snapshot = async () => {
      const list = async (directory) =>
        (
          await Promise.all(
            (await readdir(directory, { withFileTypes: true })).map(async (entry) => {
              const target = path.join(directory, entry.name);
              if (entry.name === 'node_modules') return [];
              return entry.isDirectory()
                ? list(target)
                : [[path.relative(root, target), await readFile(target, 'utf8')]];
            }),
          )
        ).flat();
      return Object.fromEntries((await list(root)).sort(([a], [b]) => a.localeCompare(b)));
    };
    const before = await snapshot();
    const { changes: planned } = await migrateProject(root, { dryRun: true });
    assert.deepEqual(await snapshot(), before, 'a dry run changes nothing');
    const { changes } = await migrateProject(root);
    assert.deepEqual(planned, changes, 'the dry run reports exactly what the migration does');
    const byKind = (kind) =>
      changes.filter((change) => change.kind === kind).map(({ kind: _kind, ...rest }) => rest);
    const byFrom = (list) => [...list].sort((a, b) => (a.from < b.from ? -1 : 1));
    assert.deepEqual(
      byFrom(byKind('rename')),
      byFrom([
        {
          from: 'foundation.config.ts',
          to: 'bitakit.config.ts',
          detail: 'defineFoundation → defineBitaKit',
        },
        { from: 'src/actions/save.action.ts', to: 'src/actions/save.ts' },
        { from: 'src/actions.refresh.ts', to: 'src/actions/refresh.ts' },
        { from: 'src/configs.actions.refresh.ts', to: 'src/configs/actions/refresh.ts' },
        { from: 'src/services.logging.ts', to: 'src/services/logging.ts' },
        // Legacy pages and views move file by file; the suffix is dropped in the same step.
        { from: 'src/pages/home.page.tsx', to: 'src/ui/pages/home.tsx' },
        { from: 'src/views/workspace.view.tsx', to: 'src/ui/slots/workspace.tsx' },
        { from: 'src/plugins/todos/actions/add.action.ts', to: 'src/plugins/todos/actions/add.ts' },
        { from: 'src/plugins/todos/pages/index.tsx', to: 'src/plugins/todos/ui/pages/index.tsx' },
        {
          from: 'src/plugins/todos/views/app-bar.end.view.tsx',
          to: 'src/plugins/todos/ui/slots/app-bar.end.tsx',
        },
      ]),
    );
    assert.deepEqual(byKind('move'), []);
    assert.deepEqual(
      byKind('rewrite').map((change) => change.from),
      ['src/app/layout.tsx', 'package.json', '.gitignore'],
    );
    assert.deepEqual(
      byKind('delete').map((change) => change.from),
      [
        'src/pages',
        'src/views',
        'src/plugins/todos/pages',
        'src/plugins/todos/views',
        '.foundation',
        'foundation-env.d.ts',
      ],
    );
    const after = await snapshot();
    assert.deepEqual(Object.keys(after), [
      '.gitignore',
      'bitakit.config.ts',
      'package.json',
      'src/actions/refresh.ts',
      'src/actions/save.ts',
      'src/app/layout.tsx',
      'src/configs/actions/refresh.ts',
      'src/plugins/todos/actions/add.ts',
      'src/plugins/todos/services.ts',
      'src/plugins/todos/ui/pages/index.tsx',
      'src/plugins/todos/ui/slots/app-bar.end.tsx',
      'src/services/logging.ts',
      'src/ui/pages/home.tsx',
      'src/ui/slots/workspace.tsx',
    ]);
    assert.equal(
      after['bitakit.config.ts'],
      "import { defineBitaKit } from '@bitakit/discovery';\nexport default defineBitaKit({});\n",
    );
    assert.equal(
      after['src/app/layout.tsx'],
      "import '../bitakit.gen.css';\nimport { foundationConfig } from '../bitakit.gen';\nimport { defineAction } from '@bitakit/core';\n",
    );
    assert.equal(
      after['.gitignore'],
      'node_modules/\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n',
    );
    assert.equal(JSON.parse(after['package.json']).scripts.dev, 'bitakit generate && next dev');
    assert.deepEqual((await migrateProject(root)).changes, [], 'the migration is idempotent');
    const generated = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(generated.warnings, [], 'a migrated project is free of legacy warnings');
    const config = (await loadGenerated(generated.generated)).createBitaKitConfig();
    assert.deepEqual(
      config.ui.pages.map((page) => page.path),
      ['/home'],
    );
    assert.deepEqual(
      config.plugins[0].ui.pages.map((page) => page.path),
      ['/todos'],
    );
    assert.deepEqual(
      config.plugins[0].ui.slots.map((view) => view.slot),
      ['app-bar.end'],
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(config.config)),
      { actions: { refresh: { pageSize: 7 } } },
      'the dotted config file is discovered at its folder path',
    );
  }));

test('watchBitaKit generates once at start and again after a source change', async () =>
  fixture(async (root, put) => {
    await put('src/plugins/todos/actions/add.ts', 'export default { execute: () => 1 }');
    const generated = path.join(root, 'src/bitakit.gen.ts');
    const errors = [];
    const stop = watchBitaKit(root, (error) => errors.push(error));
    try {
      await until(() => exists(generated));
      assert.match(await readFile(generated, 'utf8'), /plugins\/todos\/actions\/add/);
      await put('src/plugins/todos/actions/remove.ts', 'export default { execute: () => 2 }');
      await until(async () =>
        (await readFile(generated, 'utf8')).includes('plugins/todos/actions/remove'),
      );
    } finally {
      await stop();
    }
    assert.deepEqual(errors, []);
  }));

test('collection exports and individual files register identical actions and services', async () => {
  const refresh = defineAction({ execute: () => 42 });
  const collection = discoverActions([file({ refresh }, '', 'actions/index.ts')], 'content');
  const separate = discoverActions([file(refresh, 'refresh', 'actions/refresh.ts')], 'content');
  assert.equal(collection[0].id, separate[0].id);
  assert.equal(collection[0].id, 'content.refresh');
  assert.equal(
    discoverActions([file({ execute: () => 1 }, 'plain')], 'content')[0].kind,
    'action',
    'plain objects are normalized',
  );
  const logging = defineService(() => ({ log: () => 'logged' }));
  assert.equal(discoverServices([file({ logging }, '')], 'content')[0].id, 'content.logging');
  assert.equal(discoverServices([file(logging, 'logging')], 'content')[0].id, 'content.logging');
  assert.throws(
    () =>
      discoverActions([
        file({ refresh }, '', 'actions/index.ts'),
        file(refresh, 'refresh', 'actions/refresh.ts'),
      ]),
    /actions\/index\.ts.*actions\/refresh\.ts/,
  );
  assert.throws(
    () => discoverActions([file(() => refresh, 'factory', 'actions/factory.ts')]),
    /class and factory exports are no longer discovered/,
  );
});

test('config assembly is order independent, rejects conflicts and reads own keys only', async () => {
  const entries = [
    file({ pageSize: 20 }, ''),
    file({ pageSize: 50 }, 'actions.refresh'),
    file({ pageSize: 5 }, 'actions.publish'),
  ];
  const tree = discoverConfig(entries);
  assert.deepEqual(tree, discoverConfig([...entries].reverse()));
  const config = new ConfigService([{ id: 'content', config: tree }]);
  assert.equal(config.context('content', ['refresh']).action.get('pageSize'), 50);
  assert.equal(config.context('content', ['publish']).action.get('pageSize'), 5);
  assert.equal(config.plugin('content').get('toString'), undefined);
  assert.throws(
    () =>
      discoverConfig([
        file({ pageSize: 1 }, '', 'configs/index.ts'),
        file(2, 'pageSize', 'configs/pageSize.ts'),
      ]),
    /configs\/index\.ts.*configs\/pageSize\.ts/,
  );
  assert.throws(
    () => discoverConfig([file(1, 'actions'), file(2, 'actions.refresh')]),
    /Duplicate config/,
  );
  assert.throws(
    () => discoverConfig([file(2, 'actions.refresh'), file(1, 'actions')]),
    /Duplicate config/,
  );
  assert.throws(() => {
    config.plugin('content').snapshot().pageSize = 1;
  }, TypeError);
});

test('runtime supplies isolated config to two actions and to service factories', async () => {
  const actionFiles = [
    file(defineAction({ execute: ({ config }) => config.action.get('pageSize') }), 'refresh'),
    file(defineAction({ execute: ({ config }) => config.action.get('pageSize') }), 'publish'),
  ];
  const config = discoverConfig([
    file({ pageSize: 20, actions: { refresh: { pageSize: 50 }, publish: { pageSize: 5 } } }, ''),
  ]);
  const services = discoverServices(
    [
      file(
        defineService(({ config: own }) => ({ pageSize: own.plugin.get('pageSize') })),
        'logging',
      ),
    ],
    'content',
  );
  const plugin = {
    id: 'content',
    config,
    services,
    actions: discoverActions(actionFiles, 'content'),
  };
  const first = createRuntime({ plugins: [plugin] });
  const second = createRuntime({
    plugins: [plugin],
    configOverrides: { content: { actions: { refresh: { pageSize: 99 } } } },
  });
  const stopFirst = first.mount();
  const stopSecond = second.mount();
  try {
    assert.equal((await first.actions.execute('content.refresh')).value, 50);
    assert.equal((await first.actions.execute('content.publish')).value, 5);
    assert.equal((await second.actions.execute('content.refresh')).value, 99);
    assert.equal(first.services.content.logging.pageSize, 20);
  } finally {
    stopFirst();
    stopSecond();
  }
});

test('plugin interceptors affect their own actions only and receive target config', async () => {
  const seen = [];
  const runtime = createRuntime({
    plugins: [
      {
        id: 'one',
        config: { actions: { run: { count: 1 } } },
        actions: discoverActions([file(defineAction({ execute: () => {} }), 'run')], 'one'),
        interceptors: [
          defineInterceptor({ before: ({ config }) => void seen.push(config.action.get('count')) }),
        ],
      },
      {
        id: 'two',
        actions: discoverActions([file(defineAction({ execute: () => {} }), 'run')], 'two'),
      },
    ],
  });
  const stop = runtime.mount();
  try {
    await runtime.actions.execute('two.run');
    assert.deepEqual(seen, []);
    await runtime.actions.execute('one.run');
    assert.deepEqual(seen, [1]);
  } finally {
    await stop();
  }
});

test('schema receives resolved overrides before services are created', async () => {
  let created = false;
  const schema = {
    parse(value) {
      if (value.limit < 1) throw new Error('positive limit required');
      return value;
    },
  };
  const plugin = {
    id: 'content',
    config: { refresh: defineConfig({ schema, defaults: { limit: 10 } }) },
    services: { service: defineService(() => void (created = true)) },
  };
  assert.throws(
    () =>
      createRuntime({ plugins: [plugin], configOverrides: { content: { refresh: { limit: 0 } } } }),
    /positive limit/,
  );
  assert.equal(created, false);
});

test('an explicit action ID does not change the discovered config path', async () => {
  const actions = discoverActions(
    [
      file(
        defineAction({ id: 'custom.id', execute: ({ config }) => config.action.get('size') }),
        'refresh',
      ),
    ],
    'content',
  );
  const runtime = createRuntime({
    plugins: [{ id: 'content', config: { actions: { refresh: { size: 23 } } }, actions }],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.actions.get('content.refresh'), undefined);
    assert.equal((await runtime.actions.execute('custom.id')).value, 23);
  } finally {
    await stop();
  }
});

test('root schema, array replacement and snapshot copying respect the configuration contract', async () => {
  const root = defineConfig({
    schema: { parse: (value) => ({ ...value, parsed: true }) },
    defaults: { values: [1, 2] },
  });
  const tree = discoverConfig([file(root, '', 'configs/index.ts')]);
  const override = { values: [3] };
  const service = new ConfigService([{ id: 'one', config: tree }], { one: override });
  override.values.push(4);
  assert.deepEqual(service.plugin('one').get('values'), [3]);
  assert.equal(service.plugin('one').get('parsed'), true);
  assert.throws(
    () => discoverConfig([file(root, '', 'configs/index.ts'), file(1, 'size')]),
    /Root config schema/,
  );
  assert.throws(
    () => new ConfigService([{ id: 'one', config: { mutable: new Date() } }]),
    /plain objects/,
  );
});

test('explicit composition removes plugin interceptors and config overrides with their owners', async () => {
  const discovered = {
    configOverrides: { content: { count: 5 } },
    plugins: [
      {
        id: 'content',
        interceptors: [defineInterceptor({ before: () => assert.fail('Excluded interceptor') })],
      },
    ],
  };
  const selected = resolveBitaKitConfig(discovered, { plugins: [] });
  new BitaKitRuntime(createActionList(), selected).mount()();
  assert.deepEqual(selected.configOverrides, {});
  assert.deepEqual(
    resolveBitaKitConfig(discovered, { interceptors: [] }).plugins[0].interceptors,
    [],
  );
  assert.equal(discovered.plugins[0].interceptors.length, 1);
});

test('root app setup follows dependencies and cleans up before them', async () => {
  const events = [];
  const runtime = createRuntime({
    appId: 'content',
    dependencies: ['shell'],
    ui: { pages: [{ path: '/contents', component: () => null }] },
    setup: () => {
      events.push('app');
      return () => events.push('app cleanup');
    },
    plugins: [
      {
        id: 'shell',
        setup: () => {
          events.push('shell');
          return () => events.push('shell cleanup');
        },
      },
    ],
  });
  assert.equal(runtime.modules[0].pages[0].path, '/contents');
  const dispose = runtime.mount();
  assert.deepEqual(events, ['shell', 'app']);
  await dispose();
  assert.deepEqual(events, ['shell', 'app', 'app cleanup', 'shell cleanup']);
});

test('the @bitakit/core/discovery subpath re-exports @bitakit/discovery', async () => {
  const discovery = await import('@bitakit/discovery');
  const viaCore = await import('@bitakit/core/discovery');
  assert.deepEqual(Object.keys(viaCore).sort(), Object.keys(discovery).sort());
  assert.equal(viaCore.generateBitaKit, discovery.generateBitaKit);
  assert.equal(viaCore.describeModule, discovery.describeModule);
});

test('app JSON themes are additive Shell options and malformed files name their source', async () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ dependencies: { '@acme/shell': '1.0.0' } }));
    await put(
      'node_modules/@acme/shell/package.json',
      JSON.stringify({
        name: '@acme/shell',
        exports: { './package.json': './package.json', './plugin': './plugin.js' },
        bitakit: { plugin: './plugin', configuration: 'shell' },
      }),
    );
    await put(
      'node_modules/@acme/shell/plugin.js',
      'export default (options) => ({ id: "shell", options });',
    );
    await put(
      'src/themes/ocean.json',
      JSON.stringify({ schemaVersion: 1, id: 'ocean', name: 'Ocean' }),
    );
    const result = await generateBitaKit(root, { quiet: true });
    const generated = await readFile(result.generated, 'utf8');
    assert.match(generated, /themes: \[\.\.\.options.get\("shell.themes", \[\]\)/);
    assert.match(generated, /"id":"ocean"/);
    // A JSON number would widen to `number`; Shell's option type needs the literal 1.
    assert.match(generated, /\.\.\.\(\[\{"schemaVersion":1,[^\]]*\}\] as const\)/);
    await put('src/themes/ocean.json', '{broken');
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /Invalid app theme src\/themes\/ocean.json/,
    );
  }));

test('slot definitions use every discovery spelling, generate payload types and stay separate from UI', async () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ name: 'slots-demo' }));
    // A custom app ID must not prefix app-root slot names.
    await put('src/plugin.config.ts', `export default { id: 'host' };`);
    await put('bitakit.config.ts', `export default { slots: ['shell.header.actions'] };`);
    await put(
      'src/slots/footer.ts',
      `import { defineSlot } from '@bitakit/core'; export default defineSlot({ accepts: 'component' });`,
    );
    const consumer = await put(
      'consumer.ts',
      `
      import type { SlotMap, SlotPayload, SlotData } from '@bitakit/core';
      const payload: SlotPayload<'shell.header.actions'> = { collapsed: true };
      // @ts-expect-error The schema types the owner's context.
      const invalid: SlotPayload<'shell.header.actions'> = { collapsed: 'yes' };
      const count: SlotData<'shell.totals'> = { count: 1 };
      const policy: SlotMap['shell.header.actions']['policy'] = 'list';
      // @ts-expect-error App-root slots are unprefixed.
      type Bad = SlotMap['host.footer'];
      void [payload, invalid, count, policy];
    `,
    );
    const definition = `defineSlot({ accepts: 'actions', payload: { parse: (_input: unknown) => ({ collapsed: true as boolean }) } })`;
    const forms = [
      ['header.actions.ts', definition],
      ['header/actions.ts', definition],
      ['header/index.ts', `{ actions: ${definition} }`],
      ['index.ts', `{ header: { actions: ${definition} } }`],
    ];
    const slotRoot = path.join(root, 'src/plugins/shell/slots');
    for (const [name, expression] of forms) {
      await rm(slotRoot, { recursive: true, force: true });
      await put(
        `src/plugins/shell/slots/${name}`,
        `import { defineSlot } from '@bitakit/core'; export default ${expression};`,
      );
      await put(
        'src/plugins/shell/slots/totals.ts',
        `import { defineSlot } from '@bitakit/core'; export default defineSlot({ accepts: 'data', schema: { parse: (_value: unknown) => ({ count: 1 }) }, policy: 'keyed' });`,
      );
      await put('src/plugins/widget/ui/slots/footer.tsx', 'export default () => null;');
      const result = await generateBitaKit(root, { quiet: true });
      assert.deepEqual(typeErrors([result.generated, consumer], root), []);
      const { createBitaKitConfig } = await loadGenerated(result.generated);
      const runtime = createRuntime(createBitaKitConfig());
      const shell = runtime.modules.find((module) => module.id === 'shell');
      assert.deepEqual(shell.slots.map((slot) => slot.id).sort(), [
        'shell.header.actions',
        'shell.totals',
      ]);
      assert.equal(runtime.modules[0].slots[0].id, 'footer');
      assert.equal(
        runtime.modules.find((module) => module.id === 'widget').views[0].slot,
        'footer',
      );
      const description = await describeBitaKit(root);
      assert.deepEqual(description.slotDeclarations.map(({ id }) => id).sort(), [
        'footer',
        'shell.header.actions',
        'shell.totals',
      ]);
      assert.deepEqual(description.unresolvedSlots, []);
    }
    await put(
      'src/plugins/shell/slots/header.actions.ts',
      `import { defineSlot } from '@bitakit/core'; export default ${definition};`,
    );
    const result = await generateBitaKit(root, { quiet: true });
    const generated = await loadGenerated(result.generated);
    assert.throws(
      () => generated.createBitaKitConfig(),
      /Duplicate contribution.*index.ts.*header.actions.ts|Duplicate contribution.*header.actions.ts.*index.ts/,
    );
  }));

test('migration rewrites setup scope, placement slot names and slot attachments on the syntax tree', () => {
  const rewrite = (source, options) => rewriteScopeAndSlots(source, options).code;
  const setup = [
    'export default ({ app, services }) => {',
    "  // the row's menu: an apostrophe in a comment must not stop later rewrites",
    "  app.slots.attach('shell.toolbar', { actionId: 'notes.open' }, { availability: 'wait' });",
    "  app.slots.attach(contribution, { availability: 'wait' });",
    '};',
  ].join('\n');
  assert.equal(
    rewrite(setup, { setupFile: true }),
    [
      'export default ({ scope: app, services }) => {',
      "  // the row's menu: an apostrophe in a comment must not stop later rewrites",
      "  app.slots.attach({ slot: 'shell.toolbar', actionId: 'notes.open' }, { availability: 'wait' });",
      "  app.slots.attach(contribution, { availability: 'wait' });",
      '};',
    ].join('\n'),
  );
  const actions = [
    "defineAction({ slots: ['shell.navigation', { key: 'a', name: 'notes.row' }], execute() {} });",
    "defineAction({ slots: [{ name: 'people.menu', input: ({ payload }) => ({ name: payload.name }) }] });",
  ].join('\n');
  assert.equal(
    rewrite(actions),
    [
      "defineAction({ slots: ['shell.navigation', { key: 'a', slot: 'notes.row' }], execute() {} });",
      "defineAction({ slots: [{ slot: 'people.menu', input: ({ payload }) => ({ name: payload.name }) }] });",
    ].join('\n'),
  );
  // Plugin objects and runtime options are BitaKit setup positions; other `setup` helpers are not.
  assert.equal(
    rewrite("definePlugin({ id: 'notes', setup: ({ app }) => app.own(() => {}) });"),
    "definePlugin({ id: 'notes', setup: ({ scope: app }) => app.own(() => {}) });",
  );
  const unrelated = [
    'function setup({ app, db }) { return app.listen(3000); }',
    'setup({ app: server, db });',
    "const schedule = { slots: [{ name: 'Morning', start: 9 }] };",
    'defineAction({ execute: ({ app }) => app.actions.notes.add.execute() });',
  ].join('\n');
  assert.equal(rewrite(unrelated), unrelated);
  // An old-form call that cannot be rewritten safely is reported, not guessed.
  assert.deepEqual(
    rewriteScopeAndSlots("scope.slots.attach('notes.row', contribution);").unresolved,
    [1],
  );
});

test('migration renames the public Foundation* names to BitaKit*', () => {
  assert.equal(
    rewriteRenamedNames(
      "import { FoundationProvider, useFoundationApp, type FoundationConfig } from '@bitakit/ui';",
    ),
    "import { BitaKitRuntimeProvider, useBitaKitApp, type BitaKitRuntimeConfig } from '@bitakit/ui';",
  );
  // Only the imported Vite plugin and its calls change; the word in comments and strings stays.
  assert.equal(
    rewriteRenamedNames(
      "import { foundation } from '@bitakit/tanstack/config';\n// The foundation (shared) layer\nplugins: [foundation()]",
    ),
    "import { bitakit } from '@bitakit/tanstack/config';\n// The foundation (shared) layer\nplugins: [bitakit()]",
  );
  assert.equal(
    rewriteRenamedNames(
      "import { foundation as vite } from '@bitakit/tanstack/config';\nplugins: [vite()]",
    ),
    "import { bitakit as vite } from '@bitakit/tanstack/config';\nplugins: [vite()]",
  );
  assert.equal(
    rewriteRenamedNames("import { withFoundation, defineFoundation } from '@bitakit/next/config';"),
    "import { withBitaKit, defineBitaKit } from '@bitakit/next/config';",
  );
  // Longer names and unrelated words stay.
  const other = 'const foundationLayer = MyFoundationProviderWrapper;';
  assert.equal(rewriteRenamedNames(other), other);
});

test('every 0.2 rename target is exported by a package, so migrated code compiles', async () => {
  const packages = fileURLToPath(new URL('../../', import.meta.url));
  const sources = (
    await Promise.all(
      (await readdir(packages)).map(async (name) =>
        (await files(path.join(packages, name, 'src')).catch(() => []))
          .filter((file) => /\.(ts|tsx|mjs)$/.test(file))
          .map((file) => readFile(file, 'utf8')),
      ),
    )
  ).flat();
  const text = (await Promise.all(sources)).join('\n');
  for (const target of new Set(Object.values(renamed))) {
    const declared = new RegExp(
      `export\\s+(?:declare\\s+)?(?:async\\s+)?(?:function\\*?|const|let|class|type|interface|enum)\\s+${target}\\b|export\\s+(?:type\\s+)?\\{[^}]*\\b${target}\\b[^}]*\\}`,
    );
    assert.match(text, declared, `${target} is not exported by any package`);
  }
});

test('migration moves Core names out of @bitakit/ui imports; React bindings stay', () => {
  const core = new Set([
    'defineAction',
    'ActionStatus',
    'BitaKitRuntimeConfig',
    'createActionList',
  ]);
  const ui = new Map([
    ['@bitakit/ui', new Set(['useAction', 'BitaKitRuntimeProvider', 'useBitaKitApp'])],
    ['@bitakit/ui/actions', new Set(['ActionButton', 'useAction'])],
  ]);
  const move = (source) => moveCoreImports(source, { core, ui });
  assert.equal(
    move(
      "import { BitaKitRuntimeProvider, useBitaKitApp, type BitaKitRuntimeConfig } from '@bitakit/ui';",
    ),
    "import { BitaKitRuntimeProvider, useBitaKitApp } from '@bitakit/ui';\nimport { type BitaKitRuntimeConfig } from '@bitakit/core';",
  );
  assert.equal(
    move('import type { ActionStatus } from "@bitakit/ui/actions";'),
    'import type { ActionStatus } from "@bitakit/core";',
  );
  assert.equal(
    move("import { ActionButton, createActionList as list } from '@bitakit/ui/actions';"),
    "import { ActionButton } from '@bitakit/ui/actions';\nimport { createActionList as list } from '@bitakit/core';",
  );
  const untouched =
    "import { useAction } from '@bitakit/ui';\nimport { unknownName } from '@bitakit/ui';";
  assert.equal(move(untouched), untouched);
  // The real lists come from the installed type declarations.
  const installed = exportedNames(fileURLToPath(new URL('..', import.meta.url)), '@bitakit/core');
  assert.ok(installed.has('defineAction') && installed.has('BitaKitRuntimeConfig'));
  assert.equal(installed.has('useAction'), false);
  assert.equal(exportedNames(tmpdir(), '@bitakit/not-installed'), undefined);
});

test('migrateProject renames helpers in root config files and reports Core names it cannot move', () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ name: 'start', type: 'module' }));
    await put(
      'vite.config.ts',
      "import { foundation } from '@bitakit/tanstack/config';\n// The foundation layer\nexport default { plugins: [foundation()] };\n",
    );
    await put(
      'bitakit.config.ts',
      "import { defineFoundation } from '@bitakit/next/config';\nexport default defineFoundation({});\n",
    );
    await put(
      'src/lib/types.ts',
      "import { defineAction } from '@bitakit/ui';\nexport { defineAction };\n",
    );
    const { changes: planned } = await migrateProject(root, { dryRun: true });
    const { changes } = await migrateProject(root);
    assert.deepEqual(planned, changes);
    assert.deepEqual(
      changes.filter((change) => change.kind === 'rewrite').map((change) => change.from),
      ['bitakit.config.ts', 'vite.config.ts'],
    );
    assert.equal(
      await readFile(path.join(root, 'vite.config.ts'), 'utf8'),
      "import { bitakit } from '@bitakit/tanstack/config';\n// The foundation layer\nexport default { plugins: [bitakit()] };\n",
    );
    assert.match(
      await readFile(path.join(root, 'bitakit.config.ts'), 'utf8'),
      /defineBitaKit\(\{\}\)/,
    );
    // Without an installed @bitakit/core the export lists are unknown: report, never guess.
    assert.deepEqual(
      changes.filter((change) => change.kind === 'skip').map((change) => change.from),
      ['src/lib/types.ts'],
    );
    assert.equal(
      await readFile(path.join(root, 'src/lib/types.ts'), 'utf8'),
      "import { defineAction } from '@bitakit/ui';\nexport { defineAction };\n",
    );
  }));

test('a nested plugin folder with its own plugin.config.ts becomes a child plugin of the folder around it', () =>
  fixture(async (root, put) => {
    await put('package.json', JSON.stringify({ name: 'app' }));
    await put('src/plugins/crm/services/accounts.ts', 'export default () => ({});');
    await put('src/plugins/crm/deals/plugin.config.ts', 'export default {};');
    await put('src/plugins/crm/deals/services/pipeline.ts', 'export default () => ({});');
    await put(
      'src/plugins/crm/deals/notes/plugin.config.ts',
      "export default { id: 'deal-notes' };",
    );
    await put('src/plugins/crm/deals/notes/actions/add.ts', 'export default { execute() {} };');
    // An ordinary subfolder without a manifest stays part of its plugin.
    await put('src/plugins/crm/services/import/csv.ts', 'export default () => ({});');
    const generated = await generateBitaKit(root, { quiet: true });
    const config = (await loadGenerated(generated.generated)).createBitaKitConfig();
    const byId = Object.fromEntries(config.plugins.map((plugin) => [plugin.id, plugin]));
    assert.equal(byId.crm.parent, undefined);
    assert.equal(byId.deals.parent, 'crm');
    assert.equal(byId['deal-notes'].parent, 'deals');
    assert.deepEqual(
      byId.crm.services.map((service) => service.id).sort(),
      ['crm.accounts', 'crm.import.csv'],
      'nested child folders are not part of the parent plugin',
    );
    const description = await describeBitaKit(root);
    const described = Object.fromEntries(description.plugins.map((plugin) => [plugin.id, plugin]));
    assert.equal(described.deals.parent, 'crm');
    assert.deepEqual(described['deal-notes'].dependencies, ['deals']);
  }));

test('layout files become layout.<family> candidates; undeclared families become app slots; choose reaches the runtime', async () =>
  fixture(async (root, put) => {
    await put(
      'package.json',
      JSON.stringify({ name: 'layouts-demo', dependencies: { '@acme/frames': '1.0.0' } }),
    );
    // A package that declares the auth family itself, as Shell does.
    await put(
      'node_modules/@acme/frames/package.json',
      JSON.stringify({
        name: '@acme/frames',
        exports: { './package.json': './package.json', './plugin': './plugin.js' },
        bitakit: { plugin: './plugin' },
      }),
    );
    await put(
      'node_modules/@acme/frames/plugin.js',
      `export default () => ({ id: 'frames', slots: { auth: { kind: 'slot', id: 'layout.auth', accepts: 'component', policy: 'single', conflict: 'error' } } });`,
    );
    await put(
      'node_modules/@acme/frames/plugin.d.ts',
      `declare const plugin: () => { id: 'frames'; slots: { auth: import('@bitakit/core').LayoutSlot & { id: 'layout.auth' } } };\nexport default plugin;`,
    );
    await put(
      'node_modules/@acme/frames/plugin.slots.json',
      JSON.stringify({
        version: 1,
        definitions: [
          {
            id: 'layout.auth',
            accepts: 'component',
            policy: 'single',
            file: 'plugin.js',
            plugin: 'frames',
          },
        ],
        unresolved: [],
      }),
    );
    await put('bitakit.config.ts', `export default { choose: { 'layout.auth': 'split' } };`);
    const layout = 'export default ({ children }: { children?: unknown }) => children;';
    await put('src/layouts/full-page.tsx', layout);
    await put('src/layouts/auth/split.tsx', layout);
    await put('src/layouts/auth/centered.tsx', layout);
    await put('src/layouts/README.md', 'not a layout');
    await put('src/plugins/brand/ui/layouts/auth/brand.tsx', layout);
    await put('src/plugins/brand/ui/layouts/onboarding.tsx', layout);
    await put(
      'src/plugins/brand/ui/pages/welcome.tsx',
      `export const layout = 'onboarding';\nexport default () => null;`,
    );
    const consumer = await put(
      'consumer.ts',
      `
      import type { SlotName } from '@bitakit/core';
      import './src/bitakit.gen';
      const families: SlotName[] = ['layout.onboarding', 'layout.full-page'];
      export default families;
      `,
    );
    const result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(typeErrors([result.generated, consumer], root), []);
    const { createBitaKitConfig } = await loadGenerated(result.generated);
    const config = createBitaKitConfig();
    assert.deepEqual(config.choose, { 'layout.auth': 'split' });
    assert.equal(config.ui.layouts, undefined, 'layouts are slot candidates now');
    const runtime = createRuntime(config);
    const app = runtime.modules.find((module) => module.id === 'app');
    // The package declares layout.auth; the app declares only the families nobody else does.
    assert.deepEqual(
      app.slots.map((slot) => [slot.id, slot.policy]),
      [
        ['layout.full-page', 'single'],
        ['layout.onboarding', 'single'],
      ],
    );
    const candidates = (id) =>
      runtime.modules
        .find((module) => module.id === id)
        .views.map(({ slot, key }) => `${slot}:${key}`);
    assert.deepEqual(candidates('app'), [
      'layout.auth:centered',
      'layout.auth:split',
      'layout.full-page:default',
    ]);
    assert.deepEqual(candidates('brand'), ['layout.auth:brand', 'layout.onboarding:default']);
    const description = await describeBitaKit(root);
    assert.deepEqual(
      description.app.layouts.map(({ family, variant, file }) => [family, variant, file]),
      [
        ['auth', 'centered', 'src/layouts/auth/centered.tsx'],
        ['auth', 'split', 'src/layouts/auth/split.tsx'],
        ['full-page', 'default', 'src/layouts/full-page.tsx'],
      ],
    );
    assert.deepEqual(
      description.plugins
        .find((plugin) => plugin.id === 'brand')
        .layouts.map(({ family }) => family),
      ['auth', 'onboarding'],
    );

    await put('bitakit.config.ts', `export default { choose: { 'layout.auth': 3 } };`);
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /choose\["layout.auth"\] in bitakit.config.ts must name a candidate/,
    );
  }));
