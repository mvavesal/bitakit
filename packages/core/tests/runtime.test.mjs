import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import {
  ActionGroup,
  BitaKitRuntime,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  isBitaKitStartupError,
  mergePluginMessages,
} from '../dist/core.js';

test('createRuntime creates the ActionList unless one is passed, and accepts host services', async () => {
  const notes = definePlugin({
    id: 'notes',
    services: { store: defineService(() => ({ count: () => 2 }), { exposeAs: 'store' }) },
    actions: {
      count: defineAction({
        execute: ({ services }) => services.store.count() + services.notes.store.count(),
      }),
    },
  });
  const runtime = createRuntime({ plugins: [notes] });
  assert.ok(runtime instanceof BitaKitRuntime);
  const stop = runtime.mount();
  try {
    assert.equal((await runtime.actions.execute('notes.count')).value, 4);
  } finally {
    await stop();
  }
  const actions = createActionList();
  const auth = { signOut: () => {} };
  const shared = createRuntime({ plugins: [notes] }, { actions, services: { auth } });
  assert.equal(shared.actions, actions);
  const stopShared = shared.mount();
  try {
    assert.equal(shared.services.auth, auth);
    assert.ok(actions.get('notes.count'));
  } finally {
    stopShared();
  }
});

test('a pending action survives translation updates; scopes clean up on stop and come back on remount', async () => {
  const list = createActionList();
  let finish,
    calls = 0;
  const runtime = new BitaKitRuntime(list, {
    groups: ['users.menu'],
    plugins: [
      definePlugin({
        id: 'users',
        actions: {
          invite: defineAction({
            title: 'users.title',
            execute: async () => {
              calls++;
              await new Promise((resolve) => {
                finish = resolve;
              });
            },
          }),
        },
        setup({ scope }) {
          scope.actions.getGroup('users.menu').attach('users.invite');
        },
      }),
    ],
  });
  runtime.setTranslations((key) => `en:${key}`);
  const cleanup = runtime.mount();
  assert.equal(list.get('users.invite').groups[0].id, 'users.menu');
  assert.equal(list.get('users.invite').title, 'en:users.title');
  const pending = list.execute('users.invite');
  runtime.setTranslations((key) => `de:${key}`);
  assert.equal(list.get('users.invite').title, 'de:users.title');
  assert.equal(list.get('users.invite').pending, true);
  assert.deepEqual(await list.execute('users.invite'), { status: 'skipped', reason: 'pending' });
  finish();
  await pending;
  assert.equal(calls, 1);
  assert.equal(list.get('users.invite').pending, false);
  await cleanup();
  assert.deepEqual(Object.keys(list.getState().actions), []);
  const again = runtime.mount();
  assert.ok(list.get('users.invite'));
  assert.equal(list.get('users.invite').groups[0].id, 'users.menu');
  await again();
  assert.deepEqual(Object.keys(list.getState().actions), []);
});

test('failed setup rolls back actions, placements and services without touching host actions', async () => {
  const list = createActionList([{ id: 'host', title: 'Host' }]);
  let stopped = 0;
  const runtime = new BitaKitRuntime(list, {
    groups: ['menu'],
    plugins: [
      definePlugin({
        id: 'broken',
        services: {
          test: defineService(({ onStop }) => {
            onStop(() => stopped++);
            return {};
          }),
        },
        actions: { run: defineAction({ execute() {} }) },
        setup({ scope }) {
          scope.actions.getGroup('menu').attach('host');
          throw new Error('Setup failed');
        },
      }),
    ],
  });
  assert.throws(
    () => runtime.mount(),
    (error) =>
      isBitaKitStartupError(error) &&
      error.plugin === 'broken' &&
      /Setup failed/.test(error.message),
  );
  await runtime.stopped;
  assert.deepEqual(Object.keys(list.getState().actions), ['host']);
  assert.equal(list.get('host').groups.length, 0);
  await runtime.stopped;
  assert.equal(stopped, 1);
});

test('setup receives the plugin scope and services, and its cleanup runs on stop', async () => {
  const log = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        services: { s: defineService(() => ({ name: 'service' })) },
        setup({ scope, services }) {
          log.push(['setup', services.demo.s.name, typeof scope.actions.getGroup]);
          const handle = scope.actions
            .getGroup('demo.menu')
            .add({ id: 'demo.dynamic', title: 'Dynamic', execute: () => 'dynamic' });
          log.push(['added', typeof handle.dispose]);
          return () => log.push(['cleanup']);
        },
      }),
    ],
  });
  const stop = runtime.mount();
  assert.equal((await runtime.actions.execute('demo.dynamic')).value, 'dynamic');
  assert.equal(runtime.actions.get('demo.dynamic').groups[0].id, 'demo.menu');
  await stop();
  assert.equal(runtime.actions.get('demo.dynamic'), undefined);
  assert.deepEqual(log, [['setup', 'service', 'function'], ['added', 'function'], ['cleanup']]);
});

test('service dependency failures are explicit and release created services', async () => {
  let stopped = 0;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'test',
        services: {
          first: defineService(({ onStop }) => {
            onStop(() => stopped++);
            return {};
          }),
          second: defineService(() => ({}), { requires: ['missing'] }),
        },
      }),
    ],
  });
  assert.throws(
    () => runtime.mount(),
    (error) =>
      isBitaKitStartupError(error) &&
      error.plugin === 'test' &&
      /Service "test\.second" requires service "missing", but no service has that name/.test(
        error.message,
      ),
  );
  await runtime.stopped;
  assert.equal(stopped, 1);
});

test('plugin messages fall back per key without mutating host dictionaries', async () => {
  const app = {
    en: { users: { last: 'English' } },
    de: { users: { title: 'App', fallback: 'Deutsch' } },
  };
  const plugins = {
    en: { users: { title: 'Plugin EN' } },
    de: { users: { title: 'Plugin DE' } },
  };
  const result = mergePluginMessages({ app, plugins, locale: 'de' });
  assert.equal(result.users.title, 'App');
  assert.equal(result.users.fallback, 'Deutsch');
  assert.equal(result.users.last, 'English');
  assert.equal(app.de.users.title, 'App');
});

test('host catalogs override plugin keys and add a language with per-key fallback', async () => {
  const plugins = {
    en: { shell: { title: 'Shell', help: 'Help' } },
    de: { shell: { title: 'Rahmen' } },
  };
  const app = { en: { shell: { title: 'Application' } }, fa: { shell: { title: 'برنامه' } } };
  assert.equal(mergePluginMessages({ app, plugins, locale: 'de' }).shell.title, 'Rahmen');
  assert.deepEqual(mergePluginMessages({ app, plugins, locale: 'fa' }).shell, {
    title: 'برنامه',
    help: 'Help',
  });
  assert.equal(mergePluginMessages({ app, plugins, locale: 'en' }).shell.title, 'Application');
  assert.equal(plugins.en.shell.title, 'Shell');
});

test('a group keeps its title whichever registration or configured entry mentions it first', async () => {
  const titled = () =>
    defineAction({
      id: 'todos.export',
      groups: [new ActionGroup('todos.bulk', 'Bulk actions')],
      execute() {},
    });
  const plain = () => defineAction({ id: 'todos.clear', groups: ['todos.bulk'], execute() {} });
  const cases = [
    ['plain name first', {}, [plain(), titled()]],
    ['titled group first', {}, [titled(), plain()]],
    ['configured groups first', { groups: ['todos.bulk'] }, [plain(), titled()]],
  ];
  for (const [label, config, actions] of cases) {
    const runtime = createRuntime({ ...config, plugins: [definePlugin({ id: 'todos', actions })] });
    const stop = runtime.mount();
    try {
      assert.equal(runtime.getGroup('todos.bulk').title, 'Bulk actions', label);
      assert.equal(runtime.getGroup(new ActionGroup('todos.bulk')).title, 'Bulk actions', label);
      for (const id of ['todos.clear', 'todos.export'])
        assert.ok(
          runtime.actions.get(id).groups.some((group) => group.id === 'todos.bulk'),
          `${label}: ${id}`,
        );
    } finally {
      await stop();
    }
  }
  const runtime = createRuntime({});
  runtime.getGroup(new ActionGroup('todos.bulk', 'First'));
  assert.equal(runtime.getGroup(new ActionGroup('todos.bulk', 'Second')).title, 'First');
  assert.throws(() => createRuntime({ groups: ['a', 'a'] }), /listed twice/);
});
