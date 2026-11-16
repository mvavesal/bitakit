import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../dist/core.js';
import {
  contributionsOf,
  createServer,
  defineAction,
  definePlugin,
  defineService,
  isBitaKitStartupError,
  withPluginOrigin,
} from '../dist/server/index.js';
import { as, provider, quiet, rejection } from './server-fixtures.mjs';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const registry = () => globalThis[Symbol.for('bitakit.servers')];

/** A config whose service counts its creations and whose operation names its generation. */
function counted(name, counter = { created: 0, stopped: 0 }) {
  return {
    counter,
    config: {
      plugins: [
        definePlugin({
          id: 'todos',
          services: {
            store: defineService(({ onStop }) => {
              counter.created += 1;
              onStop(() => {
                counter.stopped += 1;
              });
              return { name };
            }),
          },
          actions: {
            which: defineAction({
              access: 'public',
              expose: true,
              execute: ({ services }) => services.todos.store.name,
            }),
            slow: defineAction({
              access: 'public',
              execute: async ({ services }) => {
                await tick(20);
                return services.todos.store.name;
              },
            }),
          },
        }),
      ],
    },
  };
}

test('createServer never boots at import; the first use boots once', async () => {
  const { counter, config } = counted('a');
  const server = createServer(config);
  await tick();
  assert.equal(counter.created, 0);
  const caller = server.as(new Headers());
  assert.equal(counter.created, 0, 'as() alone does not boot');
  assert.deepEqual(await Promise.all([caller.todos.which(), caller.todos.which()]), ['a', 'a']);
  await server.ready;
  assert.equal(counter.created, 1);
  assert.deepEqual(
    (await server.operations()).map(({ id, plugin, access, exposed }) => [
      id,
      plugin,
      access,
      exposed,
    ]),
    [
      ['todos.which', 'todos', 'public', true],
      ['todos.slow', 'todos', 'public', false],
    ],
  );
  await server.stop();
  assert.equal(counter.stopped, 1);
});

test('a failed boot answers SERVICE_UNAVAILABLE with a reference; the startup error is logged once, never sent', async () => {
  const server = createServer({
    plugins: [
      definePlugin({
        id: 'todos',
        services: {
          store: defineService(({ onStart }) => {
            onStart(() => {
              throw new Error('cannot reach postgres://admin:pw@db');
            });
            return {};
          }),
        },
        actions: { which: defineAction({ access: 'public', expose: true, execute: () => 1 }) },
      }),
    ],
  });
  const logged = await quiet('error', async () => {
    for (let index = 0; index < 3; index++) {
      const error = await rejection(server.call('todos.which', undefined, new Headers()));
      assert.equal(error.code, 'SERVICE_UNAVAILABLE');
      assert.equal(error.status, 503);
      assert.equal(error.safeMessage, `The server is not available. Reference: ${error.requestId}`);
      assert.doesNotMatch(JSON.stringify(error.toJSON()), /postgres/);
    }
    assert.ok(isBitaKitStartupError(await rejection(server.ready)));
    await rejection(server.operations());
  });
  const startup = logged.filter((line) =>
    line.some((part) => String(part?.message ?? part).includes('postgres')),
  );
  assert.equal(startup.length, 1, 'the startup error is logged once');
  await server.stop();
});

test('stop() drains in-flight calls, then stops services; later calls are refused', async () => {
  const { counter, config } = counted('a');
  const server = createServer(config);
  const caller = server.as(new Headers());
  await server.ready;
  const running = [caller.todos.slow(), caller.todos.slow()];
  await tick();
  const stopped = server.stop();
  assert.equal((await rejection(caller.todos.which())).code, 'SERVICE_UNAVAILABLE');
  assert.equal(counter.stopped, 0, 'services stay up while calls run');
  assert.deepEqual(await Promise.all(running), ['a', 'a']);
  await stopped;
  assert.equal(counter.stopped, 1);
  assert.equal((await rejection(caller.todos.which())).code, 'SERVICE_UNAVAILABLE');
});

test('live-kernel registry: the same stamp boots once; a newer stamp swaps in development; old handles forward', async () => {
  const instance = `test-${Math.random()}`;
  const first = counted('first');
  const copyA = createServer(first.config, { instance, stamp: 'one' });
  const copyB = createServer(first.config, { instance, stamp: 'one' });
  assert.equal(await copyA.as(new Headers()).todos.which(), 'first');
  assert.equal(await copyB.as(new Headers()).todos.which(), 'first');
  assert.equal(first.counter.created, 1, 'a second module copy reuses the live kernel');
  assert.equal(registry()[instance].stamp, 'one');

  const second = counted('second');
  const inFlight = copyA.as(new Headers()).todos.slow();
  await tick();
  const reloaded = createServer(second.config, { instance, stamp: 'two' });
  assert.equal(await reloaded.as(new Headers()).todos.which(), 'second');
  assert.equal(await copyA.as(new Headers()).todos.which(), 'second', 'the old handle forwards');
  assert.equal(await inFlight, 'first', 'the old kernel drains before it stops');
  await tick(30);
  assert.equal(first.counter.stopped, 1);
  assert.equal(second.counter.created, 1);
  await reloaded.stop();
  assert.equal(second.counter.stopped, 1);
  // The stopped kernel stays registered: no handle of the instance boots a second one.
  assert.equal(
    (await rejection(copyB.as(new Headers()).todos.which())).code,
    'SERVICE_UNAVAILABLE',
  );
  assert.equal(second.counter.created, 1);
});

test('operations() after stop() rejects with SERVICE_UNAVAILABLE and starts nothing', async () => {
  for (const shared of [true, false]) {
    for (const used of [true, false]) {
      const options = shared ? { instance: `test-${Math.random()}`, stamp: 's' } : {};
      const { counter, config } = counted('a');
      const server = createServer(config, options);
      if (used) await server.as(new Headers()).todos.which();
      await server.stop();
      const error = await rejection(server.operations());
      assert.equal(error.code, 'SERVICE_UNAVAILABLE');
      await server.ready;
      assert.deepEqual(counter, { created: used ? 1 : 0, stopped: used ? 1 : 0 });
      if (options.instance && used) assert.ok(registry()[options.instance].kernel);
      if (options.instance && !used) assert.equal(registry()[options.instance], undefined);
    }
  }
});

test('two handles of one instance (two bundles): stopping one stops the shared kernel for both', async () => {
  const instance = `test-${Math.random()}`;
  const { counter, config } = counted('a');
  const x = createServer(config, { instance, stamp: 's' });
  const y = createServer(config, { instance, stamp: 's' });
  assert.equal(await x.as(new Headers()).todos.which(), 'a');
  assert.equal(await y.as(new Headers()).todos.which(), 'a');
  await x.stop();
  assert.equal((await rejection(y.as(new Headers()).todos.which())).code, 'SERVICE_UNAVAILABLE');
  assert.equal((await rejection(y.operations())).code, 'SERVICE_UNAVAILABLE');
  await y.ready;
  await y.stop();
  assert.deepEqual(counter, { created: 1, stopped: 1 });
  // In development a newer module copy still replaces the stopped kernel.
  const next = counted('next');
  const reloaded = createServer(next.config, { instance, stamp: 'newer' });
  assert.equal(await reloaded.as(new Headers()).todos.which(), 'next');
  await reloaded.stop();
  assert.deepEqual(next.counter, { created: 1, stopped: 1 });
});

test('a stale module copy never stops the kernel of the newer copy that replaced it', async () => {
  const instance = `test-${Math.random()}`;
  const first = counted('first');
  const second = counted('second');
  const stale = createServer(first.config, { instance, stamp: 'one' });
  assert.equal(await stale.as(new Headers()).todos.which(), 'first');
  const current = createServer(second.config, { instance, stamp: 'two' });
  assert.equal(await current.as(new Headers()).todos.which(), 'second');
  await tick();
  assert.equal(first.counter.stopped, 1, 'the swap stopped the old kernel');
  await stale.stop();
  assert.equal(
    (await rejection(stale.as(new Headers()).todos.which())).code,
    'SERVICE_UNAVAILABLE',
  );
  assert.equal(await current.as(new Headers()).todos.which(), 'second');
  assert.deepEqual(second.counter, { created: 1, stopped: 0 });
  await current.stop();
  assert.deepEqual(second.counter, { created: 1, stopped: 1 });
});

test('in production the first kernel wins and a different stamp warns once', async () => {
  const instance = `test-${Math.random()}`;
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const first = counted('first');
    const second = counted('second');
    const live = createServer(first.config, { instance, stamp: 'one' });
    assert.equal(await live.as(new Headers()).todos.which(), 'first');
    const late = createServer(second.config, { instance, stamp: 'two' });
    const warned = await quiet('warn', async () => {
      assert.equal(await late.as(new Headers()).todos.which(), 'first');
      assert.equal(await late.as(new Headers()).todos.which(), 'first');
    });
    assert.equal(warned.length, 1);
    assert.equal(second.counter.created, 0);
    await live.stop();
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test('exposure: package plugins never publish themselves; a missing static entry warns', async () => {
  const action = defineAction({ access: 'public', expose: true, execute: () => 1 });
  const server = createServer(
    {
      actions: { ping: action },
      plugins: [
        withPluginOrigin(definePlugin({ id: 'vendor', actions: { sync: action } }), {
          kind: 'package',
          package: { name: '@acme/vendor', version: '1.0.0' },
        }),
        withPluginOrigin(definePlugin({ id: 'local', actions: { run: action } }), {
          kind: 'local',
        }),
        definePlugin({ id: 'manual', actions: { run: action } }),
      ],
    },
    { operations: ['ping', 'local.run'] },
  );
  const warned = await quiet('warn', async () => {
    assert.deepEqual(
      (await server.operations()).map(({ id, exposed }) => `${id}:${exposed}`),
      ['ping:true', 'vendor.sync:false', 'local.run:true', 'manual.run:true'],
    );
  });
  assert.equal(warned.length, 1);
  assert.match(
    warned[0][0],
    /server:manual\.run is exposed over HTTP but missing from the generated remote/,
  );
  assert.equal(
    (await rejection(server.call('vendor.sync', undefined, new Headers()))).code,
    'NOT_FOUND',
  );
  assert.equal(
    await server.call('vendor.sync', undefined, new Headers(), { exposedOnly: false }),
    1,
  );
  await server.stop();
});

test('server mode: uninstalled contribution kinds boot and stay readable; no ActionList, no structural updates', async () => {
  const config = {
    contributions: { storage: [{ id: 'app-disk' }] },
    plugins: [
      definePlugin({
        id: 'media',
        contributions: { storage: [{ id: 'local' }, { id: 's3' }] },
        actions: { ping: defineAction({ access: 'public', execute: () => 'pong' }) },
      }),
    ],
  };
  assert.deepEqual(
    contributionsOf(config, 'storage').map(({ plugin, value }) => `${plugin}:${value.id}`),
    ['app:app-disk', 'media:local', 'media:s3'],
  );
  assert.deepEqual(
    contributionsOf(config.plugins, 'storage').map(({ value }) => value.id),
    ['local', 's3'],
  );
  const server = createServer(config);
  assert.equal(await server.as(new Headers()).media.ping(), 'pong');
  await server.stop();
  // The client runtime still refuses a kind nobody installs.
  assert.throws(
    () => createRuntime(config).mount(),
    /contributes "storage", but no enabled plugin installs that kind/,
  );

  const runtime = createRuntime(config, { mode: 'server' });
  runtime.mount();
  await runtime.ready;
  try {
    assert.equal(runtime.mode, 'server');
    assert.deepEqual(Object.keys(runtime.actions.getState().actions), []);
    assert.throws(
      () => runtime.plugins.add([definePlugin({ id: 'x' })]),
      /not supported in server mode/,
    );
    assert.throws(
      () => runtime.plugins.disable('media', { dependents: 'stop' }),
      /not supported in server mode/,
    );
    assert.throws(() => runtime.reconcilePlugins(config.plugins), /not supported in server mode/);
    assert.throws(
      () => runtime.bindHostAction('x', defineAction({ access: 'public', execute() {} })),
      /server mode/,
    );
  } finally {
    await runtime.stop();
  }
});

test('host plugins from options join the composition (for example installers of server kinds)', async () => {
  const installed = [];
  const server = createServer(
    {
      plugins: [
        definePlugin({
          id: 'media',
          contributions: { storage: [{ id: 'local' }] },
          actions: { ping: defineAction({ access: 'user', execute: ({ ctx }) => ctx.user.id }) },
        }),
      ],
    },
    {
      services: { requestContext: provider() },
      plugins: [
        definePlugin({
          id: 'storage-host',
          installs: {
            storage: (values, { module }) => void installed.push(`${module}:${values.length}`),
          },
        }),
      ],
    },
  );
  assert.equal(await server.as(as('member')).media.ping(), 'u1');
  assert.deepEqual(installed, ['media:1']);
  await server.stop();
});
