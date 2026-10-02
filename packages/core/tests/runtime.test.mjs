import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import {
  ActionGroup,
  FoundationRuntime,
  createRuntime,
  defineAction,
  defineFormAction,
  defineService,
  mergePluginMessages,
} from '../dist/core.js';

test('createRuntime creates the ActionList unless one is passed, and accepts host services', async () => {
  const notes = {
    id: 'notes',
    services: [defineService({ id: 'notes.store', exposeAs: 'store', create: () => ({ count: () => 2 }) })],
    actions: [defineAction({ id: 'notes.count', execute: ({ services }) => services.store.count() })],
  };
  const runtime = createRuntime({ plugins: [notes] });
  assert.ok(runtime instanceof FoundationRuntime);
  const stop = runtime.mount();
  try {
    assert.equal((await runtime.actions.execute('notes.count')).value, 2);
  } finally {
    stop();
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

const form = (submit = async () => {}) =>
  defineFormAction({
    id: 'users.invite',
    title: 'users.title',
    fields: { email: { type: 'email', label: 'email', required: true } },
    submit,
    success: { messageKey: 'success' },
    failure: { messageKey: 'error' },
  });
const config = (action) => ({
  groups: ['users.menu'],
  plugins: [
    {
      id: 'users',
      actions: [action],
      setup({ app }) {
        app.actions.getGroup('users.menu').attach(action.id);
      },
    },
  ],
});

test('pending form survives translation update; execution guard and scopes clean up on remount', async () => {
  const list = createActionList();
  let finish,
    calls = 0;
  const action = form(async () => {
    calls++;
    await new Promise((resolve) => {
      finish = resolve;
    });
  });
  const runtime = new FoundationRuntime(list, config(action));
  runtime.setTranslations((key) => `en:${key}`);
  const cleanup = runtime.mount();
  assert.equal(list.get(action.id).groups[0].id, 'users.menu');
  await list.execute(action.id);
  const state = runtime.getSnapshot();
  const pending = list.execute(`${action.id}.submit`, {
    email: 'a@example.com',
  });
  runtime.setTranslations((key) => `de:${key}`);
  assert.equal(runtime.getSnapshot(), state);
  assert.equal(list.get(action.id).title, 'de:users.title');
  assert.equal(list.get(`${action.id}.submit`).pending, true);
  runtime.close();
  assert.equal(runtime.getSnapshot(), state);
  assert.deepEqual(await list.execute(`${action.id}.submit`, { email: 'a@example.com' }), {
    status: 'skipped',
    reason: 'pending',
  });
  finish();
  await pending;
  assert.equal(calls, 1);
  runtime.close();
  assert.equal(runtime.getSnapshot(), null);
  cleanup();
  assert.deepEqual(Object.keys(list.getState().actions), []);
  const again = runtime.mount();
  assert.ok(list.get(action.id));
  again();
});

test('invalid form data never reaches the service; failed submit keeps the dialog retryable', async () => {
  const list = createActionList();
  let calls = 0;
  const action = form(async () => {
    calls++;
    throw new Error('Network');
  });
  const runtime = new FoundationRuntime(list, config(action));
  const cleanup = runtime.mount();
  assert.equal((await list.execute(`${action.id}.submit`, {})).status, 'skipped');
  await list.execute(action.id);
  await assert.rejects(list.execute(`${action.id}.submit`, { email: 'invalid' }));
  assert.equal(calls, 0);
  await assert.rejects(list.execute(`${action.id}.submit`, { email: 'a@example.com' }));
  assert.equal(calls, 1);
  assert.ok(runtime.getSnapshot());
  assert.equal(list.get(`${action.id}.submit`).pending, false);
  list.update(action.id, { enabled: false });
  assert.equal(
    (await list.execute(`${action.id}.submit`, { email: 'a@example.com' })).status,
    'skipped',
  );
  cleanup();
});

test('failed setup rolls back actions, placements and services without touching host actions', () => {
  const list = createActionList([{ id: 'host', title: 'Host' }]);
  let disposed = 0;
  const runtime = new FoundationRuntime(list, {
    groups: ['menu'],
    plugins: [
      {
        id: 'broken',
        services: [
          defineService({
            id: 'test',
            create: () => ({}),
            dispose: () => disposed++,
          }),
        ],
        actions: [form()],
        setup({ app }) {
          app.actions.getGroup('menu').attach('host');
          throw new Error('Setup failed');
        },
      },
    ],
  });
  assert.throws(() => runtime.mount(), /Setup failed/);
  assert.deepEqual(Object.keys(list.getState().actions), ['host']);
  assert.equal(list.get('host').groups.length, 0);
  assert.equal(disposed, 1);
});

test('service dependency failures are explicit and release created services', () => {
  let disposed = 0;
  const runtime = new FoundationRuntime(createActionList(), {
    groups: [],
    plugins: [
      {
        id: 'test',
        services: [
          defineService({
            id: 'first',
            create: () => ({}),
            dispose: () => disposed++,
          }),
          defineService({
            id: 'second',
            requires: ['missing'],
            create: () => ({}),
          }),
        ],
      },
    ],
  });
  assert.throws(() => runtime.mount(), /Service "second" requires service "missing"/);
  assert.equal(disposed, 1);
});

test('plugin messages fall back per key without mutating host dictionaries', () => {
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

test('host catalogs override plugin keys and add a language with per-key fallback', () => {
  const plugins = { en: { shell: { title: 'Shell', help: 'Help' } }, de: { shell: { title: 'Rahmen' } } };
  const app = { en: { shell: { title: 'Application' } }, fa: { shell: { title: 'برنامه' } } };
  assert.equal(mergePluginMessages({ app, plugins, locale: 'de' }).shell.title, 'Rahmen');
  assert.deepEqual(mergePluginMessages({ app, plugins, locale: 'fa' }).shell, { title: 'برنامه', help: 'Help' });
  assert.equal(mergePluginMessages({ app, plugins, locale: 'en' }).shell.title, 'Application');
  assert.equal(plugins.en.shell.title, 'Shell');
});

test('a group keeps its title whichever registration or configured entry mentions it first', () => {
  const titled = () =>
    defineAction({ id: 'todos.export', groups: [new ActionGroup('todos.bulk', 'Bulk actions')], execute() {} });
  const plain = () => defineAction({ id: 'todos.clear', groups: ['todos.bulk'], execute() {} });
  const cases = [
    ['plain name first', {}, [plain(), titled()]],
    ['titled group first', {}, [titled(), plain()]],
    ['configured groups first', { groups: ['todos.bulk'] }, [plain(), titled()]],
  ];
  for (const [label, config, actions] of cases) {
    const runtime = createRuntime({ ...config, plugins: [{ id: 'todos', actions }] });
    const stop = runtime.mount();
    try {
      assert.equal(runtime.getGroup('todos.bulk').title, 'Bulk actions', label);
      assert.equal(runtime.getGroup(new ActionGroup('todos.bulk')).title, 'Bulk actions', label);
      // Both actions stay in the same group, which is matched by ID.
      for (const id of ['todos.clear', 'todos.export'])
        assert.ok(runtime.actions.get(id).groups.some((group) => group.id === 'todos.bulk'), `${label}: ${id}`);
    } finally {
      stop();
    }
  }
  // Conflicting titles: the first title stays.
  const runtime = createRuntime({});
  runtime.getGroup(new ActionGroup('todos.bulk', 'First'));
  assert.equal(runtime.getGroup(new ActionGroup('todos.bulk', 'Second')).title, 'First');
});
