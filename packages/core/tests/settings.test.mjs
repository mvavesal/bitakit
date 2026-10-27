import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SettingsStore,
  createMemorySettingsStorage,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  defineSettings,
  isBitaKitStartupError,
  isSettingsDefinition,
  parseSetting,
  setting,
  settingsStorage,
} from '../dist/core.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

for (const failOld of [false, true]) {
  test(`a new identity's queued save drains after the old save ${failOld ? 'fails' : 'finishes'}`, async () => {
    const storage = createMemorySettingsStorage();
    const old = deferred();
    const calls = [];
    const store = new SettingsStore(
      [{ key: 'mode', plugin: 'app', name: 'mode', spec: setting({ default: 'light' }) }],
      () => ({
        ...storage,
        async save(key, value, context) {
          calls.push({ value, userId: context.userId });
          if (context.userId === 'A') await old.promise;
          return storage.save(key, value, context);
        },
      }),
    );
    await store.activate({ userId: 'A' });
    const a = store.set('mode', 'dark');
    const settledA = a.catch((error) => error.message);
    await store.activate({ userId: 'B' });
    const b = store.set('mode', 'system');
    assert.equal(store.state('mode').pending, true);
    assert.deepEqual(calls, [{ value: 'dark', userId: 'A' }]);
    failOld ? old.reject(new Error('old save failed')) : old.resolve();
    await settledA;
    // Assert dispatch before awaiting B: a stalled queue fails instead of hanging the test.
    assert.deepEqual(calls, [
      { value: 'dark', userId: 'A' },
      { value: 'system', userId: 'B' },
    ]);
    assert.equal(await b, 'saved');
    assert.equal(store.get('mode'), 'system');
    assert.equal(store.state('mode').pending, false);
    assert.equal(storage.data.get('user:B/mode'), 'system');
    assert.equal(storage.data.get('user:A/mode'), failOld ? undefined : 'dark');
  });
}

test('setting() and defineSettings() validate declarations and defaults', async () => {
  const todos = defineSettings({
    pageSize: setting({ default: 20 }),
    theme: setting({
      default: 'system',
      options: [{ value: 'light' }, { value: 'dark' }, { value: 'system' }],
    }),
    compact: setting({ default: false, scope: 'device', control: 'switch' }),
  });
  assert.ok(isSettingsDefinition(todos));
  assert.equal(todos.settings.pageSize.scope, 'user', 'user is the default scope');
  assert.equal(todos.settings.compact.scope, 'device');
  assert.throws(() => setting({ default: 1, scope: 'tenant' }), /Invalid setting scope "tenant"/);
  assert.throws(() => setting({ default: 1, control: 'knob' }), /Invalid setting control "knob"/);
  assert.throws(() => setting({}), /needs a default value/);
  assert.throws(
    () => defineSettings({ 'page.size': setting({ default: 1 }) }),
    /Invalid setting name "page.size"/,
  );
  assert.throws(() => defineSettings({ size: { default: 1 } }), /must be declared with setting/);
  assert.throws(
    () => defineSettings({ theme: setting({ default: 'blue', options: [{ value: 'light' }] }) }),
    /default of setting "theme" is invalid: Setting "theme" accepts "light"; got "blue"/,
  );
  assert.throws(() => parseSetting(todos.settings.pageSize, '20', 'pageSize'), /expects a number/);
  assert.equal(parseSetting(todos.settings.theme, 'dark'), 'dark');
  const schema = {
    parse: (value) => {
      if (typeof value !== 'number' || value < 1) throw new Error('min 1');
      return value;
    },
  };
  assert.throws(() => defineSettings({ n: setting({ schema, default: 0 }) }), /min 1/);
  assert.equal(parseSetting(setting({ schema, default: 1 }), 5), 5);
  // A list default with options chooses several of them; a list without options is free text.
  const channels = setting({
    default: ['email'],
    control: 'checkboxes',
    options: [{ value: 'email' }, { value: 'sms' }],
  });
  assert.deepEqual(parseSetting(channels, ['sms', 'email']), ['sms', 'email']);
  assert.throws(
    () => parseSetting(channels, ['fax'], 'channels'),
    /accepts a list of "email", "sms"; got \["fax"\]/,
  );
  assert.throws(() => parseSetting(channels, 'email', 'channels'), /accepts a list of/);
  const tags = setting({ default: ['a'], control: 'list' });
  assert.deepEqual(parseSetting(tags, ['a', 'b']), ['a', 'b']);
  assert.throws(() => parseSetting(tags, { a: 1 }, 'tags'), /expects a list/);
  const asynchronous = { '~standard': { validate: async () => ({ value: 1 }) } };
  assert.throws(
    () => defineSettings({ n: setting({ schema: asynchronous, default: 1 }) }),
    /validates asynchronously/,
  );
});

test('the store loads per identity, queues one write per key and drops late results', async () => {
  const storage = createMemorySettingsStorage({ 'todos.pageSize': 50 });
  const entries = [
    { key: 'todos.pageSize', plugin: 'todos', name: 'pageSize', spec: setting({ default: 20 }) },
    {
      key: 'todos.compact',
      plugin: 'todos',
      name: 'compact',
      spec: setting({ default: false, scope: 'device' }),
    },
    {
      key: 'todos.policy',
      plugin: 'todos',
      name: 'policy',
      spec: setting({ default: 'open', scope: 'organization' }),
    },
  ];
  const slow = [];
  const store = new SettingsStore(entries, () => ({
    ...storage,
    save(key, value, context) {
      const gate = deferred();
      slow.push({ key, value, context, gate });
      return gate.promise.then(() => storage.save(key, value, context));
    },
  }));
  assert.deepEqual(store.state('todos.pageSize'), {
    value: 20,
    ready: false,
    writable: false,
    pending: false,
  });
  await assert.rejects(store.set('todos.pageSize', 1), /not loaded yet/);
  assert.throws(() => store.state('todos.nope'), /Unknown setting "todos.nope"/);

  const changes = [];
  store.subscribe('todos.pageSize', () => changes.push(store.state('todos.pageSize')));
  let any = 0;
  store.subscribe(() => any++);
  await store.activate({ userId: 'u1' });
  assert.equal(store.get('todos.pageSize'), 50, 'seeded values load');
  assert.equal(store.state('todos.pageSize').ready, true);
  assert.equal(store.state('todos.policy').writable, false, 'no organization, no writes');
  await assert.rejects(store.set('todos.policy', 'closed'), /read-only/);
  assert.deepEqual(store.context('todos.compact'), {
    scope: 'device',
    userId: 'u1',
    organizationId: undefined,
  });

  await assert.rejects(store.set('todos.pageSize', 'many'), /expects a number/);
  const first = store.set('todos.pageSize', 30);
  const second = store.set('todos.pageSize', 31);
  const third = store.set('todos.pageSize', 32);
  assert.equal(store.state('todos.pageSize').pending, true);
  assert.equal(slow.length, 1, 'one write in flight');
  slow[0].gate.resolve();
  assert.equal(await first, 'saved');
  await tick();
  assert.equal(slow.length, 2, 'the newest queued value is sent next');
  assert.equal(slow[1].value, 32);
  slow[1].gate.resolve();
  assert.equal(await second, 'superseded');
  assert.equal(await third, 'saved');
  assert.equal(store.get('todos.pageSize'), 32);
  assert.equal(store.state('todos.pageSize').pending, false);
  assert.equal(storage.data.get('user:u1/todos.pageSize'), 32);
  assert.ok(any > 0 && changes.length > 0);

  const cancelled = store.set('todos.pageSize', 33);
  const queued = store.set('todos.pageSize', 34);
  await store.activate({ userId: 'u2' });
  assert.equal(await queued, 'cancelled', 'queued writes of the old identity are cancelled');
  slow.at(-1).gate.resolve();
  assert.equal(await cancelled, 'cancelled', 'late confirmations are dropped');
  assert.equal(store.get('todos.pageSize'), 50, 'u2 sees the seed, not u1 values');
  assert.equal(storage.data.has('user:u2/todos.pageSize'), false);

  await store.activate({ userId: 'u1' });
  assert.equal(
    store.get('todos.pageSize'),
    33,
    'the write that was already sent persisted; only its confirmation was dropped',
  );
  assert.equal(await store.reset('todos.pageSize'), 'saved');
  assert.equal(store.get('todos.pageSize'), 50, 'reset returns to the stored seed or default');

  storage.data.set('user:u1/todos.pageSize', 'broken');
  await store.refresh('todos.pageSize');
  assert.equal(store.get('todos.pageSize'), 20, 'invalid stored values fall back to the default');
  assert.match(store.state('todos.pageSize').error, /expects a number/);

  store.deactivate();
  assert.equal(store.state('todos.pageSize').ready, false);
  assert.equal(store.isActive, false);

  const failing = new SettingsStore(entries, () => ({
    load() {
      throw new Error('offline');
    },
    save() {},
  }));
  await failing.activate();
  assert.equal(failing.state('todos.pageSize').error, 'offline');
  assert.equal(failing.state('todos.pageSize').ready, false);
});

test('every context receives typed setting handles; presentation follows setting changes', async () => {
  const storage = createMemorySettingsStorage({ 'todos.pageSize': 40 });
  const todos = definePlugin({
    id: 'todos',
    settings: defineSettings({
      pageSize: setting({ default: 20 }),
      showDone: setting({ default: true }),
    }),
    services: {
      items: defineService(({ settings }) => ({
        pageSize: () => settings.todos.pageSize.get(),
        theme: () => settings.theme.get(),
      })),
    },
    actions: {
      next: defineAction({
        enabled: ({ settings }) => settings.todos.showDone.get(),
        execute: ({ settings }) => settings.todos.pageSize.set(5),
      }),
    },
  });
  const runtime = createRuntime(
    {
      settings: defineSettings({
        theme: setting({ default: 'system', options: [{ value: 'light' }, { value: 'system' }] }),
      }),
      plugins: [todos],
    },
    { services: { 'settings.storage': storage } },
  );
  assert.equal(runtime.app.settings.todos.pageSize.get(), 20, 'defaults before mount');
  assert.throws(() => runtime.app.settings.todos.nope, /Unknown setting "todos.nope"/);
  assert.throws(() => runtime.app.settings.other, /Unknown setting "other"/);
  const stop = runtime.mount();
  try {
    await runtime.ready;
    await tick();
    assert.equal(runtime.services.todos.items.pageSize(), 40, 'the provided storage is used');
    assert.equal(runtime.services.todos.items.theme(), 'system', 'app settings keep plain names');
    assert.equal(runtime.actions.get('todos.next').enabled, true);
    await runtime.settings.set('todos.showDone', false);
    assert.equal(runtime.actions.get('todos.next').enabled, false, 'presentation re-evaluates');
    await runtime.settings.set('todos.showDone', true);
    const outcome = await runtime.actions.execute('todos.next');
    assert.equal(outcome.status, 'completed');
    assert.equal(storage.data.get('user:anonymous/todos.pageSize'), 5);
    assert.equal(runtime.app.settings.todos.pageSize.get(), 5);
  } finally {
    await stop();
  }
  assert.equal(runtime.settings.state('todos.pageSize').ready, false, 'unmount deactivates');
});

test('a plugin provides the settings.storage contract; identity follows the auth contract', async () => {
  const memory = createMemorySettingsStorage();
  let snapshot = { user: null, pending: true, error: undefined };
  const listeners = new Set();
  const auth = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signOut: async () => {},
  };
  const change = (next) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const runtime = createRuntime(
    {
      plugins: [
        definePlugin({
          id: 'persistence',
          services: { db: defineService(() => memory, { provides: settingsStorage }) },
        }),
        definePlugin({
          id: 'todos',
          settings: defineSettings({
            pageSize: setting({ default: 20 }),
            policy: setting({ default: 'open', scope: 'organization' }),
          }),
        }),
      ],
    },
    { services: { auth } },
  );
  const stop = runtime.mount();
  try {
    await runtime.ready;
    await tick();
    assert.equal(runtime.settings.isActive, false, 'nothing loads while authentication is pending');
    change({ user: { id: 'u1' }, organizationId: 'acme', pending: false, error: undefined });
    await tick();
    assert.deepEqual(runtime.settings.currentIdentity, { userId: 'u1', organizationId: 'acme' });
    assert.equal(runtime.settings.state('todos.policy').writable, true);
    await runtime.settings.set('todos.pageSize', 7);
    await runtime.settings.set('todos.policy', 'strict');
    assert.equal(memory.data.get('user:u1/todos.pageSize'), 7);
    assert.equal(memory.data.get('organization:acme/todos.policy'), 'strict');
    change({ user: { id: 'u2' }, organizationId: 'acme', pending: false, error: undefined });
    await tick();
    assert.equal(runtime.settings.get('todos.pageSize'), 20, 'another user sees defaults');
    assert.equal(runtime.settings.get('todos.policy'), 'strict', 'organization values are shared');
    change({ user: null, pending: false, error: undefined });
    await tick();
    assert.deepEqual(runtime.settings.currentIdentity, {
      userId: undefined,
      organizationId: undefined,
    });
    assert.equal(runtime.settings.state('todos.policy').writable, false);
    assert.equal(listeners.size, 1, 'identity tracking adds no second subscription');
  } finally {
    await stop();
  }
});

test('setting declarations are validated at startup with attribution', async () => {
  assert.throws(
    () =>
      createRuntime({
        settings: defineSettings({ todos: setting({ default: 1 }) }),
        plugins: [
          definePlugin({ id: 'todos', settings: defineSettings({ a: setting({ default: 1 }) }) }),
        ],
      }),
    (error) => isBitaKitStartupError(error) && /Rename the app setting/.test(error.message),
  );
  assert.throws(
    () => createRuntime({ plugins: [definePlugin({ id: 'todos', settings: { a: 1 } })] }),
    (error) => isBitaKitStartupError(error) && /defineSettings/.test(error.message),
  );
});
