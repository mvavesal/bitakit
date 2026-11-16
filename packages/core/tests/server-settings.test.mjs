import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createServer,
  defineAction,
  definePlugin,
  defineService,
  defineSettings,
  setting,
  settingsStorage,
} from '../dist/server/index.js';
import { as, provider, quiet, rejection } from './server-fixtures.mjs';

/** A storage that refuses any request without the owner its scope needs. */
function strictStorage(values) {
  const requests = [];
  return {
    requests,
    service: defineService(
      () => ({
        load(key, context) {
          requests.push({ key, ...context });
          if (context.scope === 'user' && typeof context.userId !== 'string')
            throw new Error('user setting without userId');
          if (context.scope === 'organization' && typeof context.organizationId !== 'string')
            throw new Error('organization setting without organizationId');
          const owner = context.scope === 'user' ? context.userId : context.organizationId;
          return { value: values[`${owner}/${key}`], writable: true };
        },
        save() {},
      }),
      { provides: settingsStorage },
    ),
  };
}

const settings = defineSettings({
  pageSize: setting({ default: 20 }),
  color: setting({ default: 'blue', scope: 'organization' }),
  compact: setting({ default: false, scope: 'device' }),
});

function server(storage, extraActions = {}) {
  return createServer(
    {
      plugins: [
        definePlugin({
          id: 'todos',
          settings,
          services: {
            ...(storage ? { storage: storage.service } : {}),
            prefs: defineService(({ settings }) => ({
              pageSize: (ctx) => settings.todos.pageSize.load(ctx),
            })),
          },
          actions: {
            open: defineAction({
              access: 'public',
              execute: async ({ settings }) => [
                await settings.todos.pageSize.load(),
                await settings.todos.color.load(),
              ],
            }),
            mine: defineAction({
              access: 'user',
              execute: async ({ settings }) => [
                await settings.todos.pageSize.load(),
                await settings.todos.color.load(),
              ],
            }),
            team: defineAction({
              access: 'organization',
              execute: async ({ settings, services, ctx }) => [
                await settings.todos.pageSize.load(),
                await settings.todos.color.load(),
                await services.todos.prefs.pageSize(ctx),
              ],
            }),
            device: defineAction({
              access: 'public',
              execute: ({ settings }) => settings.todos.compact.load(),
            }),
            sync: defineAction({
              access: 'public',
              execute: ({ services }) => services.todos.prefs.pageSize(),
            }),
            get: defineAction({
              access: 'public',
              execute: ({ services }) => services.todos.raw(),
            }),
            ...extraActions,
          },
        }),
      ],
    },
    { services: { requestContext: provider() } },
  );
}

test('load() uses the call ctx and never asks the storage without the owner ID its scope needs', async () => {
  const storage = strictStorage({ 'u1/todos.pageSize': 50, 'o1/todos.color': 'red' });
  const app = server(storage);
  try {
    // Public: no user, no organization: both defaults, the storage is never called.
    assert.deepEqual(await app.as(as('member')).todos.open(), [20, 'blue']);
    assert.deepEqual(storage.requests, []);
    // User: the user setting loads, the organization setting stays at its default.
    assert.deepEqual(await app.as(as('member')).todos.mine(), [50, 'blue']);
    assert.deepEqual(storage.requests, [{ key: 'todos.pageSize', scope: 'user', userId: 'u1' }]);
    storage.requests.length = 0;
    // Organization: both load; a service passes the ctx it was given.
    assert.deepEqual(await app.as(as('member')).todos.team(), [50, 'red', 50]);
    assert.deepEqual(
      storage.requests.map(({ key, scope, userId, organizationId }) => [
        key,
        scope,
        userId,
        organizationId,
      ]),
      [
        ['todos.pageSize', 'user', 'u1', 'o1'],
        ['todos.color', 'organization', 'u1', 'o1'],
        ['todos.pageSize', 'user', 'u1', 'o1'],
      ],
    );
    // Another member's values are their own; missing values are defaults.
    assert.deepEqual(await app.as(as('other')).todos.team(), [20, 'blue', 20]);
  } finally {
    await app.stop();
  }
});

test('device settings, a missing ctx outside an operation and a missing storage fail clearly', async () => {
  const app = server(strictStorage({}));
  try {
    await quiet('error', async (logged) => {
      for (const [name, message] of [
        ['device', /scope "device"/],
        [
          'sync',
          /needs the request context outside an operation: settings\.todos\.pageSize\.load\(ctx\)/,
        ],
      ]) {
        const error = await rejection(app.as(as('member')).todos[name]());
        assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
        assert.match(String(logged.at(-1)[1]?.message), message);
      }
    });
  } finally {
    await app.stop();
  }
  const bare = server(undefined);
  try {
    await quiet('error', async (logged) => {
      const error = await rejection(bare.as(as('member')).todos.mine());
      assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
      assert.match(String(logged.at(-1)[1]?.message), /no service provides settings\.storage/);
    });
    // Without an owner the default answers even without a storage.
    assert.deepEqual(await bare.as(as('member')).todos.open(), [20, 'blue']);
  } finally {
    await bare.stop();
  }
});

test('process-wide get/set/subscribe throw on the server; invalid stored values fall back to the default', async () => {
  const storage = strictStorage({ 'u1/todos.pageSize': 'many' });
  const app = server(storage, {
    raw: defineAction({
      access: 'public',
      execute: ({ settings }) => {
        const handle = settings.todos.pageSize;
        return [handle.key, handle.definition.default, typeof handle.get, typeof handle.set];
      },
    }),
    write: defineAction({
      access: 'public',
      execute: ({ services }) => services.todos.writer.write(),
    }),
  });
  try {
    assert.deepEqual(await app.as(as('member')).todos.raw(), [
      'todos.pageSize',
      20,
      'undefined',
      'undefined',
    ]);
    const warned = await quiet('warn', async () => {
      assert.deepEqual(await app.as(as('member')).todos.mine(), [20, 'blue']);
    });
    assert.match(String(warned[0][0]), /stored value of setting "todos\.pageSize" is invalid/);
  } finally {
    await app.stop();
  }
  // A service's own handles are the server handles: get() explains load().
  let thrown;
  const runner = createServer({
    plugins: [
      definePlugin({
        id: 'todos',
        settings,
        services: {
          writer: defineService(({ settings }) => {
            try {
              settings.todos.pageSize.get();
            } catch (error) {
              thrown = error.message;
            }
            return {};
          }),
        },
      }),
    ],
  });
  await runner.ready;
  await runner.stop();
  assert.match(thrown, /use await settings\.todos\.pageSize\.load\(\)/);
});
