import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationServiceError,
  authService,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  getService,
  isFoundationStartupError,
  serviceKey,
} from '../dist/core.js';

const tasks = defineService(({ store }) => {
  const state = store({ items: [] });
  return {
    state,
    add: (title) => state.set((current) => ({ items: [...current.items, title] })),
    list: () => state.get().items,
  };
});

test('services form a namespaced tree: services.<plugin>.<name>, never a flat key', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        services: { tasks },
        actions: {
          add: defineAction({ execute: ({ services, input }) => services.todos.tasks.add(input) }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    await runtime.actions.execute('todos.add', 'Write tests');
    assert.deepEqual(runtime.services.todos.tasks.list(), ['Write tests']);
    assert.deepEqual(runtime.app.services.todos.tasks.list(), ['Write tests']);
    assert.equal('tasks' in runtime.services.todos, true);
    assert.deepEqual(Object.keys(runtime.services.todos), ['tasks']);
    assert.deepEqual(Object.keys(runtime.services), ['todos']);
    assert.throws(
      () => runtime.services['todos.tasks'],
      (error) =>
        error instanceof FoundationServiceError &&
        error.service === 'todos.tasks' &&
        error.reason === 'unregistered',
    );
    assert.throws(
      () => runtime.services.todos.nothing,
      (error) => error instanceof FoundationServiceError && error.service === 'todos.nothing',
    );
    assert.throws(
      () => runtime.services.unknown,
      (error) => error instanceof FoundationServiceError && error.reason === 'unregistered',
    );
    assert.equal(runtime.services.then, undefined);
    assert.equal(runtime.app.has('todos.tasks'), true);
    assert.equal(runtime.app.has('todos.nothing'), false);
    assert.equal(runtime.app.optional, undefined);
  } finally {
    await stop();
  }
});

test('exposeAs and provides add top-level aliases onto the same instance', async () => {
  const key = serviceKey('mailer');
  const session = {
    getSnapshot: () => ({ user: null, pending: false, error: undefined }),
    subscribe: () => () => {},
    signOut: async () => {},
  };
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'mail',
        services: {
          outbox: defineService(() => ({ send: (to) => `sent:${to}` }), {
            exposeAs: 'outbox',
            provides: key,
          }),
          session: defineService(() => session, { provides: authService }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    const instance = runtime.services.mail.outbox;
    assert.equal(runtime.services.outbox, instance);
    assert.equal(runtime.services.mailer, instance);
    assert.equal(getService(runtime.services, key), instance);
    assert.equal(runtime.services.auth, session);
    assert.equal(runtime.services.mail.session, session);
    for (const name of ['outbox', 'mailer', 'auth', 'mail.outbox', 'mail.session'])
      assert.equal(runtime.app.has(name), true, name);
    assert.deepEqual(Object.keys(runtime.services).sort(), ['auth', 'mail', 'mailer', 'outbox']);
  } finally {
    await stop();
  }
});

test('record services take <plugin>.<key>; array entries need an explicit id; app keys are not prefixed', async () => {
  const runtime = createRuntime({
    services: { clock: defineService(() => ({ now: () => 1 })) },
    plugins: [
      definePlugin({ id: 'todos', services: { tasks } }),
      definePlugin({
        id: 'notes',
        services: [defineService(() => ({ kind: 'notes' }), { id: 'notes.store' })],
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.services.clock.now(), 1);
    assert.equal(runtime.services.notes.store.kind, 'notes');
    assert.equal(typeof runtime.services.todos.tasks.add, 'function');
    assert.equal(runtime.app.has('clock'), true);
    assert.deepEqual(Object.keys(runtime.app.config), ['app', 'todos', 'notes']);
  } finally {
    await stop();
  }
  assert.throws(
    () =>
      createRuntime({
        plugins: [definePlugin({ id: 'broken', services: [defineService(() => ({}))] })],
      }),
    (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.equal(error.plugin, 'broken');
      assert.match(
        error.message,
        /Plugin definition in plugin "broken": A service in an array needs an id/,
      );
      return true;
    },
  );
});

test('host services are reachable by contract name and satisfy requires; requires accepts aliases', async () => {
  const auth = {
    getSnapshot: () => ({ user: { id: 'u1' }, pending: false, error: undefined }),
    subscribe: () => () => {},
    signOut: async () => {},
  };
  const seen = [];
  const runtime = createRuntime(
    {
      plugins: [
        definePlugin({
          id: 'todos',
          services: {
            tasks: defineService(() => ({ list: () => [] }), { exposeAs: 'items' }),
            report: defineService(
              ({ services }) => {
                seen.push(services.auth.getSnapshot().user.id, services.items.list().length);
                return {};
              },
              { requires: ['auth', 'items'] },
            ),
          },
          actions: {
            who: defineAction({
              requires: ['todos.tasks', 'auth'],
              execute: ({ services }) => services.auth.getSnapshot().user.id,
            }),
          },
        }),
      ],
    },
    { services: { auth } },
  );
  const stop = runtime.mount();
  try {
    assert.equal(runtime.services.auth, auth);
    assert.deepEqual(seen, ['u1', 0]);
    assert.equal((await runtime.actions.execute('todos.who')).value, 'u1');
  } finally {
    await stop();
  }
});

test('app.services explains not-ready before mount and after stop; runtime.services is live while mounted', async () => {
  const runtime = createRuntime({ plugins: [definePlugin({ id: 'todos', services: { tasks } })] });
  assert.throws(
    () => runtime.app.services.todos,
    (error) => error instanceof FoundationServiceError && error.reason === 'not-ready',
  );
  assert.throws(() => runtime.services, /not mounted/);
  assert.equal(runtime.app.has('todos.tasks'), false);
  assert.equal(runtime.app.ready, false);
  const stop = runtime.mount();
  assert.equal(runtime.app.ready, true);
  const first = runtime.services.todos.tasks;
  assert.equal(runtime.app.services.todos.tasks, first);
  await stop();
  assert.equal(runtime.app.ready, false);
  assert.equal(runtime.app.has('todos.tasks'), false);
  assert.throws(
    () => runtime.app.services.todos,
    (error) => error instanceof FoundationServiceError && error.reason === 'not-ready',
  );
  const again = runtime.mount();
  assert.notEqual(runtime.services.todos.tasks, first, 'services are created per mount');
  again();
});

test('a service factory receives one context object and may read its dependencies lazily', async () => {
  const seen = [];
  const runtime = createRuntime({
    configOverrides: { todos: { limit: 3 } },
    plugins: [
      definePlugin({
        id: 'todos',
        config: { limit: 1 },
        services: {
          tasks,
          stats: defineService((context) => {
            seen.push(Object.keys(context).sort());
            return {
              limit: context.config.plugin.get('limit'),
              count: () => context.services.todos.tasks.list().length,
            };
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(seen, [
      ['config', 'events', 'onStart', 'onStop', 'services', 'settings', 'store'],
    ]);
    assert.equal(runtime.services.todos.stats.limit, 3);
    assert.equal(runtime.services.todos.stats.count(), 0);
  } finally {
    await stop();
  }
  assert.throws(() => defineService({ id: 'x' }), /expects a factory function/);
});

test('reading a declared service before it is created explains the missing requires', () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        services: {
          reader: defineService(({ services }) => ({ value: services.demo.source.value })),
          source: defineService(() => ({ value: 1 })),
        },
      }),
    ],
  });
  assert.throws(
    () => runtime.mount(),
    (error) =>
      /requires: \["demo\.source"\]/.test(error.message) && !/Plugin "undefined"/.test(error.message),
  );
});
