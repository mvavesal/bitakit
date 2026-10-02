import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import ts from 'typescript';
import { generateFoundation } from '../discovery/generate.mjs';
import { discoverEntries } from '../discovery/entries.mjs';
import {
  discoverActions,
  discoverServices,
  discoverConfig,
  discoveredFile,
  defineConfig,
  FoundationRuntime,
  ConfigService,
  Action,
  createActionList,
} from '../dist/core.js';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'foundation-unified-'));
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
/** Strict TypeScript errors for generated output and consumers, against this build of Core. */
const typeErrors = (files, root) =>
  ts
    .getPreEmitDiagnostics(
      ts.createProgram(files, {
        noEmit: true, strict: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: root,
        paths: {
          '@bitakit/core': [new URL('../dist/core.d.ts', import.meta.url).pathname],
          '@bitakit/core/actions': [new URL('../dist/actions/core.d.ts', import.meta.url).pathname],
        },
      }),
    )
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

test('folder-only plugins provide inferred service methods, Action references and owned setup', async () =>
  fixture(async (root, put) => {
    await put('src/plugins/documents/services/documents.ts', `
      import { defineService } from '@bitakit/core';
      export default defineService({ create: () => ({
        events: [] as string[],
        createDraft: (title: string) => ({ title, status: 'draft' as const }),
        loadCount: async (folder: string) => folder.length,
      }) });
    `);
    await put('src/plugins/documents/services/clock.ts', `
      import { defineService } from '@bitakit/core';
      export default defineService({ exposeAs: 'tools.clock', create: () => ({ now: () => new Date() }) });
    `);
    await put('src/plugins/documents/actions/create.ts', `
      import { defineAction } from '@bitakit/core';
      export default defineAction({ execute: ({ app }) => app.services.documents.createDraft('New draft') });
    `);
    await put('src/plugins/documents/actions/draft.ts', `
      import { defineAction } from '@bitakit/core';
      export default defineAction({
        requires: ['documents'],
        execute: ({ services }) => services.documents.createDraft('From services'),
      });
    `);
    await put('src/plugins/documents/actions/save.ts', `
      import { defineAction } from '@bitakit/core';
      export default defineAction<{title: string}>()({
        initialState: {count: 0},
        execute(input) {
          const draft = this.app.services.documents.createDraft(input.title);
          this.state.update(current => ({count: current.count + 1}));
          return draft;
        },
      });
    `);
    await put('src/plugins/documents/interceptors/logging.ts', `
      import { defineActionInterceptor, defineServiceInterceptor } from '@bitakit/core';
      export default [
        defineActionInterceptor({ before() {} }),
        defineServiceInterceptor({service: 'documents', method: 'createDraft',
          before({args}) { const title: string = args[0]; },
          after({result}) { const title: string = result.title; },
        }),
      ];
      defineServiceInterceptor({service: 'documents',
        // @ts-expect-error Unknown method of a known service.
        method: 'unknownMethod',
      });
      defineServiceInterceptor({service: 'documents', method: 'loadCount', after({result}) {
        const count: number = result;
        // @ts-expect-error Awaited result remains a number.
        const invalid: string = result;
      }});
    `);
    await put('src/plugins/documents/setup.ts', `
      import type { Setup } from '@bitakit/core';
      const setup: Setup = ({ services }) => {
        services['documents.documents'].events.push('setup');
        return () => { services['documents.documents'].events.push('cleanup'); };
      };
      export default setup;
    `);
    await generateFoundation(root);
    const output = path.join(root, '.foundation/plugins.ts');
    const generated = await readFile(output, 'utf8');
    assert.doesNotMatch(generated, /discoverPublicServices|publicServices:/);
    const consumer = await put('consumer.ts', `
      import type { FoundationRuntime } from '@bitakit/core';
      declare const runtime: FoundationRuntime;
      const app = runtime.app;
      const date: Date = app.services.tools.clock.now();
      // @ts-expect-error exposeAs replaces the public file-derived name.
      app.services.clock;
      const title: string = app.services.documents.createDraft('Typed').title;
      app.actions.documents.save.execute({title: 'Saved'}).then(result => {
        if (result.status === 'completed') { const title: string = result.value.title; }
      });
      // @ts-expect-error Stateful Action inputs remain typed after discovery.
      app.actions.documents.save.execute({title: 42});
      const count: Promise<number> = app.services.documents.loadCount('folder');
      app.actions.documents.create.execute().then(result => {
        if (result.status === 'completed') { const title: string = result.value.title; }
      });
      // @ts-expect-error Method inputs are inferred from the service implementation.
      app.services.documents.createDraft(42);
      // @ts-expect-error Promise output remains typed.
      const wrong: Promise<string> = app.services.documents.loadCount('folder');
      app.actions.documents.draft.execute().then(result => {
        if (result.status === 'completed') { const status: 'draft' = result.value.status; }
      });
      // @ts-expect-error Services have one namespace, not root aliases.
      app.documents;
      // @ts-expect-error Unknown Actions are not part of completion.
      app.actions.documents.unknown;
    `);
    assert.deepEqual(typeErrors([output, consumer], root), []);
    const jiti = createJiti(import.meta.url, { moduleCache: false,
      alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname } });
    const { foundationConfig } = await jiti.import(output);
    const runtime = new FoundationRuntime(createActionList(), foundationConfig);
    assert.deepEqual(foundationConfig.plugins.map(plugin => plugin.id), ['documents']);
    const action = runtime.app.actions.documents.create;
    const stop = runtime.mount();
    assert.ok(runtime.app.services.tools.clock.now() instanceof Date);
    const service = runtime.app.services.documents;
    assert.equal(service, runtime.services['documents.documents']);
    assert.equal(action, runtime.app.actions.documents.create);
    assert.deepEqual((await action.execute()).value, { title: 'New draft', status: 'draft' });
    assert.deepEqual((await runtime.app.actions.documents.draft.execute()).value, {
      title: 'From services',
      status: 'draft',
    });
    await runtime.app.actions.documents.save.execute({title: 'Saved'});
    assert.deepEqual(runtime.actions.get('documents.save').state, {count: 1});
    assert.deepEqual(service.events, ['setup']);
    stop();
    assert.deepEqual(service.events, ['setup', 'cleanup']);
    assert.equal(runtime.app.optional.services.documents, undefined);
    assert.deepEqual(await action.execute(), { status: 'skipped', reason: 'missing' });
  }));

test('local plugin path, plugin ID and explicit service/Action IDs remain overridable', async () =>
  fixture(async (root, put) => {
    await put('foundation.config.ts', 'export default {plugins:{directory:"src/extensions"}}');
    await put('src/extensions/documents/plugin.config.ts', 'export default {id:"library"}');
    await put('src/extensions/documents/services/documents.ts', 'export default {id:"archive",create:()=>({read:()=>42})}');
    await put('src/extensions/documents/actions/create.ts', 'export default {id:"archive.open",execute:({app})=>app.services.archive.read()}');
    await generateFoundation(root);
    const jiti = createJiti(import.meta.url, { moduleCache: false,
      alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname } });
    const { foundationConfig } = await jiti.import(path.join(root, '.foundation/plugins.ts'));
    const runtime = new FoundationRuntime(createActionList(), foundationConfig);
    const stop = runtime.mount();
    try {
      assert.equal(foundationConfig.plugins[0].id, 'library');
      assert.equal((await runtime.app.actions.archive.open.execute()).value, 42);
      assert.equal(runtime.app.services.archive.read(), 42);
    } finally { stop(); }
  }));

test('a service name means the same service in every plugin, so generated types match the runtime', async () =>
  fixture(async (root, put) => {
    // notes publishes "store"; todos owns todos.store and publishes it as "todoStore".
    await put('src/plugins/notes/services/store.ts', `
      import { defineService } from '@bitakit/core';
      export default defineService({ create: () => ({ read: () => 'notes' }) });
    `);
    await put('src/plugins/todos/services/store.ts', `
      import { defineService } from '@bitakit/core';
      export default defineService({
        exposeAs: 'todoStore',
        create: () => ({ add: (title: string) => \`todos:\${title}\` }),
      });
    `);
    await put('src/plugins/todos/actions/inspect.ts', `
      import { defineAction } from '@bitakit/core';
      export default defineAction({
        requires: ['store', 'todoStore', 'todos.store'],
        execute: ({ services }) => [
          services.store.read(),
          services.todoStore.add('alias'),
          services['todos.store'].add('key'),
        ],
      });
    `);
    await generateFoundation(root);
    const output = path.join(root, '.foundation/plugins.ts');
    const consumer = await put('consumer.ts', `
      import type { Services } from '@bitakit/core';
      // The type every contribution receives as services, including those of the todos plugin.
      declare const services: Services;
      const notes: string = services.store.read();
      const todo: string = services.todoStore.add('alias');
      // @ts-expect-error "store" is the notes service everywhere; todos reaches its own as todoStore.
      services.store.add('x');
      // @ts-expect-error The todos service does not gain the methods of the notes service.
      services.todoStore.read();
      void [notes, todo];
    `);
    assert.deepEqual(typeErrors([output, consumer], root), []);
    const jiti = createJiti(import.meta.url, { moduleCache: false,
      alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname } });
    const { foundationConfig } = await jiti.import(output);
    const runtime = new FoundationRuntime(createActionList(), foundationConfig);
    const stop = runtime.mount();
    try {
      const outcome = await runtime.app.actions.todos.inspect.execute();
      assert.equal(outcome.status, 'completed');
      assert.deepEqual(outcome.value, ['notes', 'todos:alias', 'todos:key']);
      assert.equal(runtime.app.services.store.read(), 'notes');
      assert.equal(runtime.app.services.todoStore.add('app'), 'todos:app');
    } finally { stop(); }
  }));

test('every contribution kind shares flat, directory and mixed path normalization', async () =>
  fixture(async (root, put) => {
    for (const kind of ['actions', 'services', 'interceptors', 'configs']) {
      for (const name of [
        `${kind}.team.refresh.ts`,
        `${kind}/team/refresh.ts`,
        `${kind}/team.refresh.ts`,
      ]) {
        const source = await put(name, 'export default {}');
        assert.deepEqual((await discoverEntries(root, [source], kind))[0].path, [
          'team',
          'refresh',
        ]);
      }
      const first = path.join(root, `${kind}.team.refresh.ts`);
      const second = path.join(root, `${kind}/team/refresh.ts`);
      await assert.rejects(discoverEntries(root, [first, second], kind), /Duplicate.*team.refresh/);
    }
  }));

test('collection exports and individual files register identical actions and services', () => {
  const refresh = { execute: () => 42 };
  const collection = discoverActions([file({ refresh }, '', 'actions.ts')], 'content');
  const separate = discoverActions([file(refresh, 'refresh', 'actions.refresh.ts')], 'content');
  assert.equal(collection[0].id, separate[0].id);
  assert.equal(collection[0].id, 'content.refresh');
  const logging = { create: () => ({ log: () => 'logged' }) };
  assert.equal(discoverServices([file({ logging }, '')], 'content')[0].id, 'content.logging');
  assert.equal(discoverServices([file(logging, 'logging')], 'content')[0].id, 'content.logging');
  assert.throws(
    () =>
      discoverActions([
        file({ refresh }, '', 'actions.ts'),
        file(refresh, 'refresh', 'actions.refresh.ts'),
      ]),
    /actions.ts.*actions.refresh.ts/,
  );
});

test('config assembly is order independent, rejects conflicts and reads own keys only', () => {
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
        file({ pageSize: 1 }, '', 'configs.ts'),
        file(2, 'pageSize', 'configs.pageSize.ts'),
      ]),
    /configs.ts.*configs.pageSize.ts/,
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

test('runtime supplies isolated config to two actions, service constructors and native factories', async () => {
  const actionFiles = [
    file({ execute: ({ config }) => config.action.get('pageSize') }, 'refresh'),
    file({ execute: ({ config }) => config.action.get('pageSize') }, 'publish'),
  ];
  const config = discoverConfig([
    file(
      {
        pageSize: 20,
        actions: {
          refresh: { pageSize: 50 },
          publish: { pageSize: 5 },
          native: { title: 'Native' },
        },
      },
      '',
    ),
  ]);
  const service = discoverServices(
    [file({ create: ({ config }) => ({ pageSize: config.plugin.get('pageSize') }) }, 'logging')],
    'content',
  );
  const native = discoverActions(
    [
      file(
        ({ config }) =>
          new Action({
            title: config.action.get('title'),
            execute: () => config.plugin.get('pageSize'),
          }),
        'native',
      ),
    ],
    'content',
  );
  const plugin = {
    id: 'content',
    config,
    services: service,
    actions: [...discoverActions(actionFiles, 'content'), ...native],
  };
  const firstList = createActionList();
  const secondList = createActionList();
  const first = new FoundationRuntime(firstList, { plugins: [plugin] });
  const second = new FoundationRuntime(secondList, {
    plugins: [plugin],
    configOverrides: { content: { actions: { refresh: { pageSize: 99 } } } },
  });
  const stopFirst = first.mount();
  const stopSecond = second.mount();
  assert.equal((await firstList.execute('content.refresh')).value, 50);
  assert.equal((await firstList.execute('content.publish')).value, 5);
  assert.equal((await secondList.execute('content.refresh')).value, 99);
  assert.equal((await firstList.execute('content.native')).value, 20);
  assert.equal(firstList.get('content.native').title, 'Native');
  assert.equal(first.services['content.logging'].pageSize, 20);
  stopFirst();
  stopSecond();
});

test('plugin interceptors affect their own actions only and receive target config', async () => {
  const seen = [];
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    plugins: [
      {
        id: 'one',
        config: { actions: { run: { count: 1 } } },
        actions: discoverActions([file({ execute: () => {} }, 'run')], 'one'),
        interceptors: [
          {
            before: ({ config }) => {
              seen.push(config.action.get('count'));
            },
          },
        ],
      },
      { id: 'two', actions: discoverActions([file({ execute: () => {} }, 'run')], 'two') },
    ],
  });
  const stop = runtime.mount();
  await list.execute('two.run');
  assert.deepEqual(seen, []);
  await list.execute('one.run');
  assert.deepEqual(seen, [1]);
  stop();
});

test('schema receives resolved overrides before services are created', () => {
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
    services: [
      {
        id: 'service',
        create() {
          created = true;
        },
      },
    ],
  };
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        plugins: [plugin],
        configOverrides: { content: { refresh: { limit: 0 } } },
      }),
    /positive limit/,
  );
  assert.equal(created, false);
});

test('generation does not execute contributions and produces a working app/plugin runtime', async () =>
  fixture(async (root, put) => {
    await put('foundation.config.ts', 'export default {}');
    await put(
      'src/actions.refresh.ts',
      'export default {execute: ({config}) => config.action.get("pageSize")}',
    );
    await put('src/configs.actions.refresh.ts', 'export default {pageSize: 7}');
    await put('src/services.logging.ts', 'export default {create: () => ({log: () => 1})}');
    await put('src/plugins/content/plugin.config.ts', 'export default {id: "content"}');
    await put(
      'src/plugins/content/actions/publish.ts',
      'export default {execute: ({config}) => config.action.get("pageSize")}',
    );
    await put('src/plugins/content/configs.actions.publish.ts', 'export default {pageSize: 5}');
    await put('src/plugins/content/interceptors.log.ts', 'export default {before: () => {}}');
    await put('src/actions/helpers.ts', 'export const helper = 1');
    await put('src/configs.server.ts', 'throw new Error("server secret")');
    await generateFoundation(root);
    const output = path.join(root, '.foundation/plugins.ts');
    const source = await readFile(output, 'utf8');
    assert.doesNotMatch(source, /helpers|configs.server/);
    const jiti = createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname },
    });
    const { foundationConfig } = await jiti.import(output);
    const list = createActionList();
    const runtime = new FoundationRuntime(list, foundationConfig);
    const stop = runtime.mount();
    assert.equal((await list.execute('refresh')).value, 7);
    assert.equal((await list.execute('content.publish')).value, 5);
    assert.equal(runtime.services.logging.log(), 1);
    stop();
    await put(
      'src/actions.never.ts',
      'throw new Error("must not execute during discovery"); export default {}',
    );
    await generateFoundation(root);
  }));

test('explicit IDs do not change discovered config paths; replacements retain target scope', async () => {
  const original = discoverActions(
    [file({ id: 'custom.id', execute: () => 0 }, 'refresh')],
    'content',
  );
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    plugins: [{ id: 'content', config: { actions: { refresh: { size: 23 } } }, actions: original }],
    actions: [
      { kind: 'action', replaces: 'custom.id', execute: ({ config }) => config.action.get('size') },
    ],
  });
  const stop = runtime.mount();
  assert.equal((await list.execute('custom.id')).value, 23);
  stop();
});

test('app manifest namespaces app contributions using the same module grammar', async () =>
  fixture(async (root, put) => {
    await put('foundation.config.ts', 'export default {}');
    await put('src/plugin.config.ts', 'export default {id:"app"}');
    await put(
      'src/actions.ts',
      'export default {refresh: {execute: ({config}) => config.action.get("size")}}',
    );
    await put('src/configs.actions.refresh.ts', 'export default {size:3}');
    await put('src/services.logging.ts', 'export default {create: () => ({log: () => 1})}');
    await generateFoundation(root);
    const jiti = createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname },
    });
    const { foundationConfig } = await jiti.import(path.join(root, '.foundation/plugins.ts'));
    const list = createActionList();
    const runtime = new FoundationRuntime(list, foundationConfig);
    const stop = runtime.mount();
    assert.equal((await list.execute('app.refresh')).value, 3);
    assert.equal(runtime.services['app.logging'].log(), 1);
    stop();
  }));

test('root schema, array replacement and snapshot copying respect the configuration contract', () => {
  const root = defineConfig({
    schema: { parse: (value) => ({ ...value, parsed: true }) },
    defaults: { values: [1, 2] },
  });
  const tree = discoverConfig([file(root, '', 'configs.ts')]);
  const override = { values: [3] };
  const service = new ConfigService([{ id: 'one', config: tree }], { one: override });
  override.values.push(4);
  assert.deepEqual(service.plugin('one').get('values'), [3]);
  assert.equal(service.plugin('one').get('parsed'), true);
  assert.throws(
    () => discoverConfig([file(root, '', 'configs.ts'), file(1, 'size')]),
    /Root config schema/,
  );
  assert.throws(
    () => new ConfigService([{ id: 'one', config: { mutable: new Date() } }]),
    /plain objects/,
  );
});

test('explicit composition removes plugin interceptors and config overrides with their owners', async () => {
  const { resolveFoundationConfig } = await import('../dist/core.js');
  const discovered = {
    configOverrides: { content: { count: 5 } },
    plugins: [
      {
        id: 'content',
        interceptors: [
          {
            before() {
              assert.fail('Excluded interceptor');
            },
          },
        ],
      },
    ],
  };
  const selected = resolveFoundationConfig(discovered, { plugins: [] });
  const runtime = new FoundationRuntime(createActionList(), selected);
  runtime.mount()();
  assert.deepEqual(selected.configOverrides, {});
  assert.deepEqual(
    resolveFoundationConfig(discovered, { interceptors: [] }).plugins[0].interceptors,
    [],
  );
  assert.equal(discovered.plugins[0].interceptors.length, 1);
});

test('root app discovers pages and views without a nested plugin', async () =>
  fixture(async (root, put) => {
    await put('foundation.config.ts', 'export default {}');
    await put('src/plugin.config.ts', "export default { id: 'content', dependencies: ['shell'] }");
    await put('src/pages/home.ts', "export default { path: '/', component: () => null }");
    await put('src/views/workspace.ts', "export default { slot: 'main', component: () => null }");
    await put('src/setup.ts', 'export default () => {}');
    await generateFoundation(root);
    const generated = await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.match(generated, /pages: \[entry\d+\]/);
    assert.match(generated, /views: \[entry\d+\]/);
    assert.match(generated, /setup: entry\d+/);
    assert.match(generated, /dependencies: \["shell"\]/);
    assert.match(generated, /plugins: \[\]/);
  }));

test('root app setup follows dependencies and cleans up before them', () => {
  const events = [];
  const runtime = new FoundationRuntime(createActionList(), {
    appId: 'content',
    dependencies: ['shell'],
    pages: [{ path: '/contents', component: () => null }],
    setup: () => { events.push('app'); return () => events.push('app cleanup'); },
    plugins: [{ id: 'shell', setup: () => { events.push('shell'); return () => events.push('shell cleanup'); } }],
  });
  assert.equal(runtime.modules[0].pages[0].path, '/contents');
  const dispose = runtime.mount();
  assert.deepEqual(events, ['shell', 'app']);
  dispose();
  assert.deepEqual(events, ['shell', 'app', 'app cleanup', 'shell cleanup']);
});
