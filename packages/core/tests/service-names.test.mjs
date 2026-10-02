import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  FoundationRuntime,
  createRuntime,
  defineAction,
  defineInterceptor,
  definePlugin,
  defineService,
  discoverActions,
  discoverServices,
  discoveredFile,
  getService,
  isFoundationStartupError,
  serviceKey,
} from '../dist/core.js';

const tasks = () => {
  const items = [];
  return { add: (title) => items.push(title), list: () => [...items] };
};
const mount = (config) => {
  const runtime = createRuntime(config);
  return { runtime, stop: runtime.mount() };
};

test('a service name reaches its instance in every contribution context of a plugin', async () => {
  const seen = [];
  const { runtime, stop } = mount({
    plugins: [
      definePlugin({
        id: 'todos',
        services: { tasks: defineService(tasks, { exposeAs: 'tasks' }) },
        actions: {
          add: defineAction({
            requires: ['tasks'],
            enabled: ({ services }) => services.tasks.list().length < 2,
            execute: ({ services, input }) => services.tasks.add(input),
          }),
          show: defineAction({
            requires: ['todos.tasks'],
            enabled: ({ services }) => Array.isArray(services.todos.tasks.list()),
            dialog: () => null,
          }),
        },
        interceptors: [
          defineInterceptor({
            requires: ['tasks'],
            before: ({ services }) => void seen.push(['interceptor', services.tasks.list().length]),
          }),
        ],
        setup: ({ services }) =>
          void seen.push(['plugin setup', 'tasks' in services, 'tasks' in services.todos]),
      }),
    ],
  });
  try {
    await runtime.actions.execute('todos.add', 'Write tests');
    await runtime.actions.execute('todos.add', 'Run them');
    assert.deepEqual(runtime.services.todos.tasks.list(), ['Write tests', 'Run them']);
    // Without an observable the snapshot is not refreshed, but bound reads and execution re-evaluate.
    assert.equal(runtime.actions.resolve('todos.add').enabled, false);
    assert.deepEqual(await runtime.actions.execute('todos.add', 'Third'), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.equal(runtime.actions.resolve('todos.show').enabled, true);
    assert.deepEqual(seen, [
      ['plugin setup', true, true],
      ['interceptor', 0],
      ['interceptor', 1],
    ]);
  } finally {
    stop();
  }
});

test('a name means the same service in every plugin; a plugin reaches its own by alias or path', async () => {
  const { runtime, stop } = mount({
    plugins: [
      definePlugin({
        id: 'notes',
        services: { store: defineService(() => ({ owner: 'notes' }), { exposeAs: 'store' }) },
      }),
      definePlugin({
        id: 'todos',
        dependencies: ['notes'],
        services: { store: defineService(() => ({ owner: 'todos' }), { exposeAs: 'todoStore' }) },
        actions: {
          inspect: defineAction({
            requires: ['store', 'todoStore', 'notes.store'],
            execute: ({ services }) => [
              services.store.owner,
              services.todoStore.owner,
              services.notes.store.owner,
              services.todos.store.owner,
              getService(services, serviceKey('todos.store')).owner,
            ],
          }),
        },
      }),
    ],
  });
  try {
    assert.deepEqual((await runtime.actions.execute('todos.inspect')).value, [
      'notes',
      'todos',
      'notes',
      'todos',
      'todos',
    ]);
    assert.equal(runtime.app.services.store.owner, 'notes');
    assert.equal(runtime.services.store.owner, 'notes');
  } finally {
    stop();
  }
});

test('services, interceptors and installers receive the same service tree', async () => {
  const installed = [];
  const { runtime, stop } = mount({
    plugins: [
      definePlugin({
        id: 'reports',
        services: {
          source: defineService(() => ({ rows: () => [1, 2, 3] })),
          summary: defineService(
            ({ services }) => ({ total: () => services.reports.source.rows().length }),
            {
              requires: ['reports.source'],
              exposeAs: 'summary',
            },
          ),
        },
        interceptors: [
          defineInterceptor({
            requires: ['summary'],
            before: ({ services }) => services.summary.total() === 3,
          }),
        ],
        actions: { run: defineAction({ execute: () => 'ran' }) },
        contributions: { widgets: ['chart'] },
        installs: {
          widgets: (values, { services }) =>
            void installed.push([...values, services.reports.summary.total()]),
        },
      }),
    ],
  });
  try {
    assert.equal((await runtime.actions.execute('reports.run')).status, 'completed');
    assert.deepEqual(installed, [['chart', 3]]);
  } finally {
    stop();
  }
});

test('a missing service names the requester, suggests the full ID and attributes plugin and file', () => {
  const [action] = discoverActions(
    [
      discoveredFile(
        defineAction({ requires: ['tasks'], execute: () => {} }),
        'create',
        'src/plugins/todos/actions/create.ts',
      ),
    ],
    'todos',
  );
  const services = discoverServices(
    [discoveredFile(defineService(tasks), 'tasks', 'src/plugins/todos/services/tasks.ts')],
    'todos',
  );
  const runtime = createRuntime({ plugins: [{ id: 'todos', services, actions: [action] }] });
  assert.throws(
    () => runtime.mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'todos');
      assert.equal(error.app, false);
      assert.equal(error.source, 'src/plugins/todos/actions/create.ts');
      assert.match(
        error.message,
        /Action "todos\.create" requires service "tasks", but no service has that name\./,
      );
      assert.match(error.message, /Did you mean "todos\.tasks"\?/);
      assert.match(error.message, /Available services: todos\.tasks\./);
      assert.match(error.message, /Source: src\/plugins\/todos\/actions\/create\.ts/);
      return true;
    },
  );
});

test('an app action requiring a short name is attributed to the app and suggests the full ID', () => {
  const runtime = createRuntime({
    actions: { report: defineAction({ requires: ['data'], execute: () => {} }) },
    plugins: [definePlugin({ id: 'reports', services: { data: defineService(() => ({})) } })],
  });
  assert.throws(
    () => runtime.mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'app');
      assert.equal(error.app, true);
      assert.match(
        error.message,
        /Action "report" requires service "data", but no service has that name/,
      );
      assert.match(error.message, /Did you mean "reports\.data"\?/);
      return true;
    },
  );
});

test('service dependency cycles are reported as a path', () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'loop',
        services: {
          a: defineService(() => ({}), { requires: ['loop.b'] }),
          b: defineService(() => ({}), { requires: ['loop.a'] }),
        },
      }),
    ],
  });
  assert.throws(
    () => runtime.mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'loop');
      assert.match(error.message, /Service dependency cycle: loop\.a → loop\.b → loop\.a\./);
      return true;
    },
  );
});

test('failures inside service factories are attributed to their plugin with the original cause', () => {
  const cause = new Error('boom');
  const runtime = createRuntime({
    plugins: [
      definePlugin({ id: 'healthy', actions: { ping: defineAction({ execute: () => {} }) } }),
      definePlugin({
        id: 'broken',
        services: {
          svc: defineService(() => {
            throw cause;
          }),
        },
      }),
    ],
  });
  assert.throws(
    () => runtime.mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'broken');
      assert.equal(error.cause, cause);
      assert.match(error.message, /Service "broken\.svc" in plugin "broken" failed to start: boom/);
      return true;
    },
  );
  assert.equal(runtime.actions.get('healthy.ping'), undefined, 'a failed mount registers nothing');
});

test('name collisions and reserved segments are rejected before any service is constructed', () => {
  let created = 0;
  const service = (exposeAs) => defineService(() => ++created, { exposeAs });
  for (const name of ['', 'then', 'tools.__proto__', 'tools.toJSON', 'a..b'])
    assert.throws(
      () => createRuntime({ services: { one: service(name) } }),
      /reserved segment/,
      name,
    );
  assert.throws(
    () => createRuntime({ services: { one: service('clock'), two: service('clock') } }),
    (error) =>
      isFoundationStartupError(error) &&
      /Two services are named "clock" \(one and two\)/.test(error.message),
  );
  assert.throws(
    () => createRuntime({ services: { one: service('clock'), two: service('clock.child') } }),
    /is nested under "clock", which is already a service/,
  );
  assert.throws(
    () => createRuntime({ services: { one: service('clock.child'), two: service('clock') } }),
    /is already used as a namespace by clock\.child/,
  );
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          definePlugin({ id: 'todos', services: { store: service('store') } }),
          definePlugin({ id: 'notes', services: { store: service('store') } }),
        ],
      }),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'notes');
      assert.match(
        error.message,
        /Two services are named "store" \(todos\.store and notes\.store\)\. Rename one of the files, or set exposeAs on one of them\./,
      );
      return true;
    },
  );
  assert.equal(created, 0);
});

test('definitions created by a second copy of Core still register', async () => {
  // Inside the package so the copy resolves Core's own dependencies from the workspace.
  const root = await mkdtemp(fileURLToPath(new URL('../.copy-', import.meta.url)));
  try {
    const copy = path.join(root, 'node_modules/@bitakit/core');
    await mkdir(copy, { recursive: true });
    await cp(new URL('../dist', import.meta.url), path.join(copy, 'dist'), { recursive: true });
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    await writeFile(
      path.join(copy, 'package.json'),
      JSON.stringify({ name: manifest.name, type: 'module', exports: manifest.exports }),
    );
    const other = await import(path.join(copy, 'dist/core.js'));
    assert.notEqual(other.FoundationRuntime, FoundationRuntime);
    const warnings = [];
    const warn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      const { runtime, stop } = mount({
        plugins: [
          other.definePlugin({
            id: 'notes',
            services: { store: other.defineService(() => ({ ok: true })) },
            actions: {
              open: other.defineAction({
                title: 'Notes',
                href: '/notes',
                groups: [new other.ActionGroup('notes.menu', 'Notes')],
              }),
            },
          }),
        ],
      });
      assert.equal(runtime.actions.get('notes.open')?.href, '/notes');
      assert.equal(runtime.services.notes.store.ok, true);
      assert.equal(runtime.getGroup('notes.menu').title, 'Notes');
      stop();
    } finally {
      console.warn = warn;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /second copy of @bitakit\/core/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('href actions register from the app module without a plugin', () => {
  const { runtime, stop } = mount({
    actions: { home: defineAction({ title: 'Home', href: '/' }) },
  });
  assert.equal(runtime.actions.get('home')?.href, '/');
  assert.equal(runtime.actions.get('home')?.title, 'Home');
  stop();
});
