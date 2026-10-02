import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createActionList } from '@bitakit/core/actions';
import {
  FoundationRuntime,
  defineAction,
  defineDialogAction,
  defineFormAction,
  defineInterceptor,
  defineService,
  defineURLAction,
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
  const runtime = new FoundationRuntime(createActionList(), config);
  return { runtime, stop: runtime.mount() };
};

test('a public name reaches its service in every contribution context of a plugin', async () => {
  const seen = [];
  const { runtime, stop } = mount({
    plugins: [
      {
        id: 'todos',
        services: [defineService({ id: 'todos.tasks', exposeAs: 'tasks', create: tasks })],
        actions: [
          defineAction({
            id: 'todos.add',
            requires: ['tasks'],
            resolve: (_input, { services }) => ({ enabled: services.tasks.list().length < 2 }),
            setup: ({ services }) => void seen.push(['setup', typeof services.tasks.add]),
            execute: ({ services, input }) => services.tasks.add(input),
          }),
          defineFormAction({
            id: 'todos.create',
            requires: ['tasks'],
            fields: { title: { type: 'text', required: true } },
            submit: (values, { services }) => services.tasks.add(values.title),
          }),
          defineDialogAction({
            id: 'todos.show',
            requires: ['tasks'],
            resolve: (_input, { services }) => ({ enabled: Array.isArray(services.tasks.list()) }),
            render: () => null,
          }),
        ],
        setup: ({ services }) => void seen.push(['plugin setup', 'tasks' in services]),
      },
    ],
  });
  await runtime.actions.execute('todos.add', 'Write tests');
  assert.deepEqual(runtime.services['todos.tasks'].list(), ['Write tests']);
  assert.equal(runtime.actions.resolve('todos.show')?.enabled, true);
  assert.deepEqual(seen, [
    ['setup', 'function'],
    ['plugin setup', true],
  ]);
  stop();
});

test('a name means the same service in every plugin; a plugin reaches its own by alias or ID', async () => {
  const { runtime, stop } = mount({
    plugins: [
      {
        id: 'notes',
        services: [defineService({ id: 'notes.store', exposeAs: 'store', create: () => ({ owner: 'notes' }) })],
      },
      {
        id: 'todos',
        dependencies: ['notes'],
        services: [
          defineService({ id: 'todos.store', exposeAs: 'todoStore', create: () => ({ owner: 'todos' }) }),
        ],
        actions: [
          defineAction({
            id: 'todos.inspect',
            requires: ['store', 'todoStore', 'notes.store'],
            execute: ({ services }) => [
              services.store.owner,
              services.todoStore.owner,
              services['notes.store'].owner,
              getService(services, serviceKey('todos.store')).owner,
            ],
          }),
        ],
      },
    ],
  });
  const outcome = await runtime.actions.execute('todos.inspect');
  // Generated types describe "store" as the notes service everywhere; the runtime agrees.
  assert.deepEqual(outcome.value, ['notes', 'todos', 'notes', 'todos']);
  assert.equal(runtime.app.services.store.owner, 'notes');
  assert.equal(runtime.services.store.owner, 'notes');
  assert.equal(runtime.services['todos.store'].owner, 'todos');
  stop();
});

test('services, interceptors and installers receive services by public name', async () => {
  const installed = [];
  const { runtime, stop } = mount({
    plugins: [
      {
        id: 'reports',
        services: [
          defineService({ id: 'reports.source', exposeAs: 'source', create: () => ({ rows: () => [1, 2, 3] }) }),
          defineService({
            id: 'reports.summary',
            exposeAs: 'summary',
            requires: ['source'],
            create: ({ services }) => ({ total: () => services.source.rows().length }),
          }),
        ],
        interceptors: [
          defineInterceptor({
            requires: ['summary'],
            create: ({ services }) => ({ before: () => services.summary.total() === 3 }),
          }),
        ],
        actions: [defineAction({ id: 'reports.run', execute: () => 'ran' })],
        contributions: { widgets: ['chart'] },
        installs: {
          widgets: (values, { services }) => void installed.push([...values, services.summary.total()]),
        },
      },
    ],
  });
  assert.equal((await runtime.actions.execute('reports.run')).status, 'completed');
  assert.deepEqual(installed, [['chart', 3]]);
  stop();
});

test('a missing service names the requester, suggests close names and attributes the plugin', () => {
  const [action] = discoverActions(
    [
      discoveredFile(
        defineAction({ requires: ['task'], execute: () => {} }),
        'create',
        'src/plugins/todos/actions/create.ts',
      ),
    ],
    'todos',
  );
  const services = discoverServices(
    [discoveredFile(defineService({ create: tasks }), 'tasks', 'src/plugins/todos/services/tasks.ts')],
    'todos',
  );
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [{ id: 'todos', services, actions: [action] }],
  });
  assert.throws(
    () => runtime.mount(),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'todos');
      assert.equal(error.app, false);
      assert.equal(error.source, 'src/plugins/todos/actions/create.ts');
      assert.match(error.message, /Action "todos.create" requires service "task", but no service has that name\./);
      assert.match(error.message, /Did you mean "tasks"\?/);
      assert.match(error.message, /Available services: tasks\./);
      return true;
    },
  );
});

test('a short name without a public alias suggests the full service ID', () => {
  const runtime = new FoundationRuntime(createActionList(), {
    actions: [defineAction({ id: 'report', requires: ['data'], execute: () => {} })],
    plugins: [
      { id: 'reports', services: [defineService({ id: 'reports.data', create: () => ({}) })] },
    ],
  });
  assert.throws(() => runtime.mount(), (error) => {
    assert.equal(error.plugin, '@foundation/app');
    assert.equal(error.app, true);
    assert.match(error.message, /requires service "data", but no service has that name/);
    assert.match(error.message, /Did you mean "reports\.data"\?/);
    return true;
  });
});

test('dependency cycles are reported as a path', () => {
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      {
        id: 'loop',
        services: [
          defineService({ id: 'loop.a', requires: ['loop.b'], create: () => ({}) }),
          defineService({ id: 'loop.b', requires: ['loop.a'], create: () => ({}) }),
        ],
      },
    ],
  });
  assert.throws(() => runtime.mount(), (error) => {
    assert.ok(isFoundationStartupError(error));
    assert.equal(error.plugin, 'loop');
    assert.match(error.message, /Service dependency cycle: loop\.a → loop\.b → loop\.a\./);
    return true;
  });
});

test('failures inside contributions are attributed to their plugin with the original cause', () => {
  const cause = new Error('boom');
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      { id: 'healthy', actions: [defineAction({ id: 'healthy.ping', execute: () => {} })] },
      {
        id: 'broken',
        services: [defineService({ id: 'broken.svc', create: () => { throw cause; } })],
      },
    ],
  });
  assert.throws(() => runtime.mount(), (error) => {
    assert.equal(error.plugin, 'broken');
    assert.equal(error.cause, cause);
    assert.match(error.message, /Service "broken.svc" in plugin "broken" failed to start: boom/);
    return true;
  });
  assert.equal(runtime.actions.get('healthy.ping'), undefined);
});

test('two plugins exposing the same public name explain how to resolve the conflict', () => {
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        plugins: [
          { id: 'todos', services: [defineService({ id: 'todos.store', exposeAs: 'store', create: () => ({}) })] },
          { id: 'notes', services: [defineService({ id: 'notes.store', exposeAs: 'store', create: () => ({}) })] },
        ],
      }),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'notes');
      assert.match(error.message, /Plugins "todos" and "notes" both expose a service named "store"\./);
      assert.match(error.message, /exposeAs: 'notes\.store'/);
      return true;
    },
  );
});

test('actions created by a second copy of Core still register', async () => {
  // Inside the package so the copy resolves Core's own dependencies from the workspace.
  const root = await mkdtemp(fileURLToPath(new URL('../.copy-', import.meta.url)));
  try {
    const copy = path.join(root, 'node_modules/@bitakit/core');
    await mkdir(copy, { recursive: true });
    await cp(new URL('../dist', import.meta.url), path.join(copy, 'dist'), { recursive: true });
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    await writeFile(path.join(copy, 'package.json'), JSON.stringify({ name: manifest.name, type: 'module', exports: manifest.exports }));
    const other = await import(path.join(copy, 'dist/core.js'));
    assert.notEqual(other.FoundationRuntime, FoundationRuntime);
    const warnings = [];
    const warn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      const { runtime, stop } = mount({
        plugins: [{ id: 'notes', actions: [other.defineURLAction({ id: 'notes.open', title: 'Notes', href: '/notes' })] }],
      });
      assert.equal(runtime.actions.get('notes.open')?.href, '/notes');
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

test('discovered URL actions still register from this copy', () => {
  const { runtime, stop } = mount({
    actions: [defineURLAction({ id: 'home', title: 'Home', href: '/' })],
  });
  assert.equal(runtime.actions.get('home')?.href, '/');
  stop();
});
