import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  ConfigScope,
  ConfigService,
  createRuntime,
  defineAction,
  defineConfig,
  definePlugin,
  defineService,
} from '../dist/core.js';

test('defineConfig takes defaults, a schema or both; plain objects are no longer wrapped', () => {
  assert.deepEqual(defineConfig({ defaults: { a: 1 } }).defaults, { a: 1 });
  assert.equal(
    typeof defineConfig({ schema: z.object({ a: z.number() }) }).schema.parse,
    'function',
  );
  const both = defineConfig({ schema: z.object({ a: z.number().default(1) }), defaults: { a: 2 } });
  assert.deepEqual(both.defaults, { a: 2 });
  assert.equal(typeof both.schema.parse, 'function');
  assert.throws(() => defineConfig({ a: 1 }), /expects \{ defaults \} and\/or \{ schema \}/);
  assert.throws(() => defineConfig(), /expects/);
  assert.throws(() => defineConfig(null), /expects/);
});

test('plugin config merges overrides, validates with the schema and is frozen; app.config mirrors it', () => {
  const limits = defineConfig({
    schema: z.object({
      maxItems: z.number().int().positive(),
      tags: z.array(z.string()).default([]),
    }),
    defaults: { maxItems: 100 },
  });
  const plain = createRuntime({ plugins: [definePlugin({ id: 'todos', config: limits })] });
  assert.deepEqual(plain.app.config.todos, { maxItems: 100, tags: [] });
  const runtime = createRuntime({
    configOverrides: { todos: { maxItems: 50, tags: ['home'] } },
    plugins: [definePlugin({ id: 'todos', config: limits })],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(runtime.app.config.todos, { maxItems: 50, tags: ['home'] });
    assert.equal(Object.isFrozen(runtime.app.config.todos), true);
    assert.equal(Object.isFrozen(runtime.app.config.todos.tags), true);
    assert.equal(runtime.configuration.plugin('todos').get('maxItems'), 50);
    assert.equal(runtime.configuration.plugin('todos').get('missing', 'fallback'), 'fallback');
  } finally {
    stop();
  }
  assert.throws(
    () =>
      createRuntime({
        configOverrides: { todos: { maxItems: -1 } },
        plugins: [definePlugin({ id: 'todos', config: limits })],
      }),
    /maxItems/,
  );
  assert.throws(
    () =>
      createRuntime({ configOverrides: { shop: {} }, plugins: [definePlugin({ id: 'todos' })] }),
    /configOverrides names "shop".*Known: app, todos/,
  );
});

test('plain config objects still work and a schema-only config validates its overrides', () => {
  const runtime = createRuntime({
    configOverrides: { shop: { currency: 'EUR' } },
    plugins: [
      definePlugin({
        id: 'shop',
        config: defineConfig({ schema: z.object({ currency: z.enum(['EUR', 'USD']) }) }),
      }),
      definePlugin({ id: 'plain', config: { nested: { flag: true, list: [1, 2] } } }),
    ],
  });
  assert.deepEqual(runtime.app.config.shop, { currency: 'EUR' });
  assert.deepEqual(runtime.app.config.plain, { nested: { flag: true, list: [1, 2] } });
  assert.equal(Object.isFrozen(runtime.app.config.plain.nested.list), true);
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          definePlugin({
            id: 'shop',
            config: defineConfig({ schema: z.object({ currency: z.enum(['EUR', 'USD']) }) }),
          }),
        ],
      }),
    /currency/,
  );
});

test('contexts scope config to the plugin and to actions.<action path>', async () => {
  let fromService;
  const runtime = createRuntime({
    configOverrides: { todos: { actions: { create: { defaultTitle: 'Untitled' } } } },
    plugins: [
      definePlugin({
        id: 'todos',
        config: {
          pageSize: 20,
          actions: {
            create: { defaultTitle: 'New', limit: 5 },
            admin: { purge: { confirm: true } },
          },
        },
        services: {
          tasks: defineService(({ config }) => {
            fromService = [
              config.plugin.get('pageSize'),
              config.action.get('defaultTitle', 'none'),
            ];
            return {};
          }),
        },
        actions: {
          create: defineAction({
            execute: ({ config }) => [
              config.action.get('defaultTitle'),
              config.action.get('limit'),
              config.action.get('missing', 'fallback'),
              config.plugin.get('pageSize'),
              config.plugin.get('actions.create.limit'),
            ],
          }),
          'admin.purge': defineAction({ execute: ({ config }) => config.action.get('confirm') }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(fromService, [20, 'none']);
    assert.deepEqual((await runtime.actions.execute('todos.create')).value, [
      'Untitled',
      5,
      'fallback',
      20,
      5,
    ]);
    assert.equal((await runtime.actions.execute('todos.admin.purge')).value, true);
  } finally {
    stop();
  }
});

test('ConfigScope reads dotted paths with fallbacks; ConfigService rejects duplicate and unknown modules', () => {
  const scope = new ConfigScope({ actions: { refresh: { pageSize: 5 } }, flag: false });
  assert.equal(scope.get('actions.refresh.pageSize'), 5);
  assert.equal(scope.get(['actions', 'refresh', 'pageSize']), 5);
  assert.equal(scope.get('flag', true), false);
  assert.equal(scope.get('actions.missing.x', 'd'), 'd');
  assert.deepEqual(scope.scope('actions.refresh').snapshot(), { pageSize: 5 });
  assert.deepEqual(scope.scope('nothing').snapshot(), {});
  assert.throws(() => new ConfigService([{ id: 'a' }, { id: 'a' }]), /Duplicate config module "a"/);
  assert.throws(() => new ConfigService([{ id: 'a' }]).plugin('b'), /Unknown config module "b"/);
  assert.throws(
    () => new ConfigService([{ id: 'a' }], { b: {} }),
    /configOverrides names "b".*Known: a\./,
  );
  assert.throws(
    () => new ConfigService([{ id: 'a', config: { date: new Date() } }]),
    /plain objects, arrays and primitive values/,
  );
});
