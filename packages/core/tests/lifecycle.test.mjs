import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationStartupError,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  isFoundationStartupError,
} from '../dist/core.js';

test('onStart hooks run in dependency order and gate runtime.ready; onStop runs in reverse on stop', async () => {
  const log = [];
  let release;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'db',
        services: {
          connection: defineService(({ onStart, onStop }) => {
            onStart(async ({ signal }) => {
              log.push('connect');
              assert.equal(signal.aborted, false);
              await new Promise((resolve) => {
                release = resolve;
              });
              log.push('connected');
            });
            onStop(() => log.push('disconnect'));
            return { ok: true };
          }),
          cache: defineService(
            ({ onStart, onStop }) => {
              onStart(() => log.push('warm'));
              onStop(() => log.push('cool'));
              return {};
            },
            { requires: ['db.connection'] },
          ),
        },
        actions: { ping: defineAction({ execute: ({ app }) => app.ready }) },
      }),
    ],
  });
  const stop = runtime.mount();
  assert.equal(typeof stop, 'function');
  assert.equal(runtime.app.ready, false);
  assert.deepEqual(log, ['connect']);
  assert.equal(runtime.services.db.connection.ok, true, 'runtime.services is live while starting');
  assert.throws(() => runtime.app.services.db, /unavailable/, 'app.services waits for ready');
  let resolved = false;
  runtime.ready.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  assert.equal(resolved, false);
  release();
  await runtime.ready;
  assert.equal(runtime.app.ready, true);
  assert.deepEqual(log, ['connect', 'connected', 'warm']);
  assert.equal((await runtime.actions.execute('db.ping')).value, true);
  stop();
  assert.deepEqual(log, ['connect', 'connected', 'warm', 'cool', 'disconnect']);
  assert.equal(runtime.app.ready, false);
});

test('without start hooks the runtime is ready synchronously after mount and ready resolves immediately', async () => {
  const runtime = createRuntime({
    plugins: [definePlugin({ id: 'plain', services: { s: defineService(() => ({})) } })],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.app.ready, true);
    await runtime.ready;
  } finally {
    stop();
  }
});

test('a failing onStart rejects ready with an attributed startup error and leaves the app not ready', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'db',
        services: {
          connection: defineService(({ onStart }) => {
            onStart(async () => {
              throw new Error('refused');
            });
            return {};
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    await assert.rejects(runtime.ready, (error) => {
      assert.ok(isFoundationStartupError(error));
      assert.ok(error instanceof FoundationStartupError);
      assert.equal(error.plugin, 'db');
      assert.equal(error.app, false);
      assert.match(error.message, /onStart in plugin "db" failed: refused/);
      assert.equal(error.cause.message, 'refused');
      return true;
    });
    assert.equal(runtime.app.ready, false);
  } finally {
    stop();
  }
});

test('legacy dispose and onStop both run on stop; async onStop failures are logged, not thrown', async () => {
  const log = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'legacy',
        services: {
          old: defineService({
            create: () => ({ v: 1 }),
            dispose: (instance) => log.push(`dispose:${instance.v}`),
          }),
          fresh: defineService(({ onStop }) => {
            onStop(async () => {
              throw new Error('late');
            });
            onStop(() => log.push('stop'));
            return {};
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  try {
    stop();
    await new Promise((resolve) => setTimeout(resolve));
  } finally {
    console.error = original;
  }
  assert.deepEqual(log, ['stop', 'dispose:1']);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0][0]), /onStop in legacy failed/);
});

test('readiness listeners fire on both transitions and mounting twice is rejected', async () => {
  const transitions = [];
  const runtime = createRuntime({ plugins: [definePlugin({ id: 'plain' })] });
  const off = runtime.subscribeReady(() => transitions.push(runtime.isReady()));
  const stop = runtime.mount();
  assert.throws(() => runtime.mount(), /already mounted/);
  stop();
  off();
  assert.deepEqual(transitions, [true, false]);
});
