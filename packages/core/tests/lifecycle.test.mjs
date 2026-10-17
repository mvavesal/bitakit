import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BitaKitStartupError,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  createRuntimeController,
  PluginScope,
  createActionList,
  isBitaKitStartupError,
  scopeLifecycle,
} from '../dist/core.js';

test('scope lifecycle observes retained state and revokes subscriptions at owner close', async () => {
  let scope;
  const runtime = createRuntime({ plugins: [definePlugin({
    id: 'projection', setup: ({ scope: app }) => { scope = app; },
  })] });
  const stop = runtime.mount(); await runtime.ready;
  const lifecycle = scopeLifecycle(scope);
  const watched = [], subscribed = [];
  const unwatch = lifecycle.watch(state => watched.push(state.phase));
  const unsubscribe = lifecycle.subscribe(state => subscribed.push(state.phase));
  assert.deepEqual(watched, ['ready']);
  assert.deepEqual(subscribed, []);
  assert.equal(lifecycle.get(), runtime.lifecycle.get());
  scope.close();
  await stop();
  assert.deepEqual(watched, ['ready']);
  assert.deepEqual(subscribed, []);
  assert.throws(() => lifecycle.subscribe(() => {}), /no longer active/);
  unwatch(); unsubscribe();
});

test('a lifecycle watcher can close its scope during immediate delivery without leaking', async () => {
  let scope;
  const runtime = createRuntime({ plugins: [definePlugin({
    id: 'projection', setup: ({ scope: app }) => { scope = app; },
  })] });
  const stop = runtime.mount(); await runtime.ready;
  let calls = 0;
  const off = scopeLifecycle(scope).watch(() => { calls++; scope.close(); });
  await stop(); off(); off();
  assert.equal(calls, 1);
});

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
  const starting = runtime.lifecycle.get();
  assert.equal(starting.operation.kind, 'start');
  assert.ok(Number.isFinite(starting.operation.startedAt));
  const startingService = starting.services.find((entry) => entry.id === 'db.connection');
  assert.equal(startingService.phase, 'starting');
  assert.ok(Number.isFinite(startingService.since));
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
  const ready = runtime.lifecycle.get();
  assert.equal(ready.operation, null);
  assert.equal(ready.services.find((entry) => entry.id === 'db.connection').phase, 'ready');
  assert.ok(ready.services.find((entry) => entry.id === 'db.connection').since >= startingService.since);
  assert.equal((await runtime.actions.execute('db.ping')).value, true);
  await stop();
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
    await stop();
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
      assert.ok(isBitaKitStartupError(error));
      assert.ok(error instanceof BitaKitStartupError);
      assert.equal(error.plugin, 'db');
      assert.equal(error.app, false);
      assert.match(error.message, /onStart in plugin "db" failed: refused/);
      assert.equal(error.cause.message, 'refused');
      return true;
    });
    assert.equal(runtime.app.ready, false);
  } finally {
    await stop();
  }
});

test('stop awaits reverse cleanup, aggregates async errors, and reports ignored failures once', async () => {
  const log = [];
  const runtime = createRuntime({
    services: {
      first: defineService(({ onStop }) => {
        onStop(() => {
          log.push('first');
        });
        return {};
      }),
      second: defineService(({ onStop }) => {
        onStop(async () => {
          log.push('second');
          throw new Error('late');
        });
        return {};
      }),
    },
  });
  const stop = runtime.mount();
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const completion = stop();
    assert.equal(stop(), completion);
    await assert.rejects(completion, (error) => error instanceof AggregateError);
    assert.deepEqual(log, ['second', 'first']);
    assert.equal(errors.length, 1);
    assert.equal(runtime.lifecycle.get().cleanup, 'failed');
  } finally {
    console.error = original;
  }
});

test('readiness listeners fire on both transitions and mounting twice is rejected', async () => {
  const transitions = [];
  const runtime = createRuntime({ plugins: [definePlugin({ id: 'plain' })] });
  const off = runtime.subscribeReady(() => transitions.push(runtime.isReady()));
  const stop = runtime.mount();
  assert.throws(() => runtime.mount(), /already mounted/);
  await stop();
  off();
  assert.deepEqual(transitions, [true, false]);
});

function gate() {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const turn = () => new Promise((resolve) => setImmediate(resolve));

test('dependent async cleanup completes before its provider stops, with truthful stopping state', async () => {
  const flush = gate();
  const log = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'db',
        services: {
          connection: defineService(({ onStop }) => {
            onStop(() => {
              log.push('close');
            });
            return { write: () => log.push('write') };
          }),
          consumer: defineService(
            ({ services, onStop }) => {
              onStop(async () => {
                await flush.promise;
                services.db.connection.write();
                log.push('flush');
              });
              return {};
            },
            { requires: ['db.connection'] },
          ),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  const readyPlugin = runtime.lifecycle.get().plugins.find((entry) => entry.id === 'db');
  const completion = stop();
  const pending = runtime.lifecycle.get();
  assert.equal(pending.phase, 'stopping');
  assert.equal(pending.cleanup, 'pending');
  assert.equal(pending.operation.kind, 'stop');
  assert.ok(Number.isFinite(pending.operation.startedAt));
  const stoppingSince = pending.plugins.find((entry) => entry.id === 'db').since;
  assert.ok(stoppingSince >= readyPlugin.since);
  assert.throws(() => runtime.mount(), /lifecycle transition/);
  await turn();
  assert.deepEqual(log, []);
  const stillPending = runtime.lifecycle.get();
  assert.equal(stillPending.cleanup, 'pending', 'the cleanup barrier remains active until every disposer settles');
  assert.equal(stillPending.operation.kind, 'stop');
  assert.equal(stillPending.operation.startedAt, pending.operation.startedAt);
  assert.equal(stillPending.plugins.find((entry) => entry.id === 'db').since, stoppingSince);
  flush.resolve();
  await completion;
  assert.deepEqual(log, ['write', 'flush', 'close']);
  assert.equal(runtime.lifecycle.get().cleanup, 'complete');
  assert.equal(runtime.lifecycle.get().phase, 'stopped');
  assert.equal(runtime.lifecycle.get().operation, null);
  assert.ok(runtime.lifecycle.get().plugins.find((entry) => entry.id === 'db').since >= stoppingSince);
  const stopAgain = runtime.mount();
  await stop();
  assert.equal(runtime.isReady(), true, 'an old stop handle cannot stop a new mount');
  await stopAgain();
});

test('stop during startup waits for the pending hook and cleans resources acquired after abort', async () => {
  const boot = gate();
  let signal;
  const log = [];
  const runtime = createRuntime({
    services: {
      worker: defineService(({ onStart, onStop }) => {
        onStart(async (context) => {
          signal = context.signal;
          await boot.promise;
          onStop(() => {
            log.push('late-resource-closed');
          });
        });
        return {};
      }),
    },
  });
  const stop = runtime.mount();
  const ready = runtime.ready;
  const completion = stop();
  assert.equal(signal.aborted, true);
  await assert.rejects(ready, /stopped before/);
  await turn();
  assert.equal(runtime.lifecycle.get().phase, 'stopping');
  boot.resolve();
  await completion;
  assert.deepEqual(log, ['late-resource-closed']);
  assert.equal(runtime.isReady(), false);
});

test('stop cancels owned actions and waits for non-cooperative work before service teardown', async () => {
  const job = gate();
  let signal;
  const log = [];
  const runtime = createRuntime({
    services: {
      worker: defineService(({ onStop }) => {
        onStop(() => {
          log.push('close');
        });
        return {};
      }),
    },
    actions: {
      run: defineAction({
        execute: async (context) => {
          signal = context.signal;
          await job.promise;
          log.push('done');
        },
      }),
    },
  });
  const stop = runtime.mount();
  const result = runtime.actions.execute('run');
  await turn();
  const completion = stop();
  assert.equal(signal.aborted, true);
  assert.equal((await runtime.actions.execute('run')).status, 'skipped');
  await turn();
  assert.deepEqual(log, []);
  job.resolve();
  await result;
  await completion;
  assert.deepEqual(log, ['done', 'close']);
});

test('factory failure preserves the startup cause and exposes completion of partial async cleanup', async () => {
  const drain = gate();
  const log = [];
  const runtime = createRuntime({
    services: {
      partial: defineService(({ onStop }) => {
        onStop(async () => {
          await drain.promise;
          log.push('released');
        });
        throw new Error('factory failed');
      }),
    },
  });
  assert.throws(() => runtime.mount(), /factory failed/);
  assert.equal(runtime.lifecycle.get().cleanup, 'pending');
  drain.resolve();
  await runtime.stopped;
  assert.deepEqual(log, ['released']);
});

test('scope disposal awaits owned work and rejects new ownership after shutdown begins', async () => {
  const scope = new PluginScope(createActionList(), new Map());
  const wait = gate();
  const log = [];
  scope.own(() => {
    log.push('first');
  });
  scope.own(async () => {
    await wait.promise;
    log.push('last');
  });
  const completion = scope.dispose();
  assert.equal(scope.dispose(), completion);
  assert.throws(() => scope.own(() => {}), /no longer active/);
  wait.resolve();
  await completion;
  assert.deepEqual(log, ['last', 'first']);
});

test('lifecycle watchers get current readiness and cannot interfere with runtime state', async () => {
  const runtime = createRuntime({ plugins: [definePlugin({ id: 'plain' })] });
  const events = [];
  runtime.events.on('runtime.lifecycle', ({ data }) => events.push(data.phase));
  const stop = runtime.mount();
  const states = [];
  const unwatch = runtime.lifecycle.watch((state) => states.push(state.phase));
  assert.equal(states[0], 'ready');
  assert.equal(Object.isFrozen(runtime.lifecycle.get().plugins), true);
  assert.throws(() => runtime.app.events.emit('runtime.lifecycle', {}), /only by the runtime/);
  const original = console.error;
  console.error = () => {};
  const off = runtime.lifecycle.subscribe(() => {
    throw new Error('observer failure');
  });
  try {
    await stop();
  } finally {
    off();
    console.error = original;
    unwatch();
  }
  assert.equal(states.at(-1), 'stopped');
  assert.ok(events.includes('stopping'));
  assert.equal(events.at(-1), 'stopped');
});

test('per-plugin readiness progresses while startup remains serial', async () => {
  const second = gate();
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'first',
        services: {
          value: defineService(({ onStart }) => {
            onStart(async () => {});
            return {};
          }),
        },
      }),
      definePlugin({
        id: 'second',
        services: {
          value: defineService(({ onStart }) => {
            onStart(() => second.promise);
            return {};
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  await turn();
  const phases = Object.fromEntries(
    runtime.lifecycle.get().plugins.map((entry) => [entry.id, entry.phase]),
  );
  assert.equal(phases.first, 'ready');
  assert.equal(phases.second, 'starting');
  assert.equal(runtime.isReady(), false);
  second.resolve();
  await runtime.ready;
  await stop();
});

test('headless isolation retains intent and blocks service consumers as well as explicit dependents', async () => {
  const controller = createRuntimeController(
    {
      plugins: [
        definePlugin({
          id: 'broken',
          services: {
            worker: defineService(
              () => {
                throw new Error('offline');
              },
              { exposeAs: 'worker' },
            ),
          },
        }),
        definePlugin({
          id: 'consumer',
          services: { service: defineService(() => ({}), { requires: ['worker'] }) },
        }),
        definePlugin({ id: 'dependent', dependencies: ['consumer'] }),
        definePlugin({ id: 'healthy', actions: { ping: defineAction({ execute: () => 'pong' }) } }),
      ],
    },
    { failures: 'isolate' },
  );
  const stop = controller.mount();
  try {
    await controller.ready;
    const state = controller.get();
    assert.equal((await state.runtime.actions.execute('healthy.ping')).value, 'pong');
    assert.deepEqual([...state.blocked].sort(), ['consumer', 'dependent']);
    assert.equal(state.failures[0].plugin, 'broken');
    const broken = state.plugins.find((entry) => entry.id === 'broken');
    assert.equal(broken.enabled, true);
    assert.equal(broken.phase, 'failed');
    assert.equal(state.plugins.find((entry) => entry.id === 'consumer').phase, 'blocked');
  } finally {
    await stop();
  }
});

test('isolation waits for failed-attempt cleanup before constructing the next runtime', async () => {
  const cleanup = gate();
  let starts = 0;
  const controller = createRuntimeController(
    {
      plugins: [
        definePlugin({
          id: 'healthy',
          services: {
            connection: defineService(() => {
              starts++;
              return {};
            }),
          },
        }),
        definePlugin({
          id: 'broken',
          services: {
            connection: defineService(({ onStop }) => {
              onStop(() => cleanup.promise);
              throw new Error('offline');
            }),
          },
        }),
      ],
    },
    { failures: 'isolate' },
  );
  const stop = controller.mount();
  await turn();
  assert.equal(starts, 1);
  assert.equal(controller.get().phase, 'stopping');
  cleanup.resolve();
  await controller.ready;
  assert.equal(starts, 2);
  await stop();
});

test('all missing service reads are strict; optional consumers use has before reading', async () => {
  const runtime = createRuntime({});
  const stop = runtime.mount();
  for (const name of ['auth', 'i18n', 'missing']) {
    assert.equal(runtime.app.has(name), false);
    assert.throws(
      () => runtime.services[name],
      (error) => error.name === 'BitaKitServiceError' && error.service === name,
    );
  }
  await stop();
});

test('cleanup failures continue through other owners and retain the responsible plugin', async () => {
  const log = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'provider',
        services: {
          value: defineService(({ onStop }) => {
            onStop(() => {
              log.push('provider');
            });
            return {};
          }),
        },
      }),
      definePlugin({
        id: 'consumer',
        dependencies: ['provider'],
        setup({ scope }) {
          scope.own(() => {
            log.push('earlier');
          });
          return async () => {
            log.push('broken');
            throw new Error('cannot release');
          };
        },
      }),
    ],
  });
  const stop = runtime.mount();
  await assert.rejects(stop(), AggregateError);
  assert.deepEqual(log, ['broken', 'earlier', 'provider']);
  const phases = Object.fromEntries(
    runtime.lifecycle.get().plugins.map((entry) => [entry.id, entry.phase]),
  );
  assert.equal(phases.consumer, 'failed');
  assert.equal(phases.provider, 'stopped');
  assert.throws(() => runtime.mount(), /failed cleanup/);
});

test('reentrant stop requests during creation record ownership before disposing', async () => {
  const log = [];
  let requested;
  const runtime = createRuntime({
    services: {
      value: defineService(({ onStop }) => {
        requested = runtime.stop();
        onStop(() => {
          log.push('cleanup');
        });
        log.push('created');
        return {};
      }),
    },
  });
  const stop = runtime.mount();
  assert.equal(stop(), requested);
  await assert.rejects(runtime.ready, /stopped/);
  await requested;
  assert.deepEqual(log, ['created', 'cleanup']);
  assert.equal(runtime.isReady(), false);
});

test('reentrant stop during cleanup shares the original completion', async () => {
  let nested;
  const runtime = createRuntime({
    services: {
      value: defineService(({ onStop }) => {
        onStop(() => {
          nested = runtime.stop();
        });
        return {};
      }),
    },
  });
  const stop = runtime.mount();
  const completion = stop();
  await completion;
  assert.equal(nested, completion);
});

test('a service without start hooks waits for its required provider readiness', async () => {
  const pending = gate();
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'provider',
        services: {
          value: defineService(({ onStart }) => {
            onStart(() => pending.promise);
            return {};
          }),
        },
      }),
      definePlugin({
        id: 'consumer',
        services: { value: defineService(() => ({}), { requires: ['provider.value'] }) },
      }),
    ],
  });
  const stop = runtime.mount();
  assert.equal(
    runtime.lifecycle.get().plugins.find((entry) => entry.id === 'consumer').phase,
    'starting',
  );
  pending.resolve();
  await runtime.ready;
  assert.equal(
    runtime.lifecycle.get().plugins.find((entry) => entry.id === 'consumer').phase,
    'ready',
  );
  await stop();
});

test('headless fail-fast rejects attributed asynchronous startup and does not retry', async () => {
  let created = 0;
  const controller = createRuntimeController({
    plugins: [
      definePlugin({
        id: 'broken',
        services: {
          worker: defineService(({ onStart }) => {
            created++;
            onStart(async () => {
              throw new Error('offline');
            });
            return {};
          }),
        },
      }),
    ],
  });
  const stop = controller.mount();
  await assert.rejects(controller.ready, (error) => error.plugin === 'broken');
  assert.equal(controller.get().phase, 'failed');
  assert.equal(created, 1);
  await stop();
});

test('isolation never starts another generation after rejected cleanup', async () => {
  let created = 0;
  const controller = createRuntimeController(
    {
      plugins: [
        definePlugin({
          id: 'healthy',
          services: {
            value: defineService(() => {
              created++;
              return {};
            }),
          },
        }),
        definePlugin({
          id: 'broken',
          services: {
            value: defineService(({ onStop }) => {
              onStop(async () => {
                throw new Error('still held');
              });
              throw new Error('offline');
            }),
          },
        }),
      ],
    },
    { failures: 'isolate' },
  );
  controller.mount();
  await assert.rejects(controller.ready, AggregateError);
  assert.equal(created, 1);
  assert.equal(controller.get().phase, 'failed');
  await assert.rejects(controller.stop(), AggregateError);
  assert.throws(() => controller.mount(), /failed cleanup/);
});

test('stopping during isolation cleanup cancels the queued retry', async () => {
  const pending = gate();
  let created = 0;
  const controller = createRuntimeController(
    {
      plugins: [
        definePlugin({
          id: 'broken',
          services: {
            value: defineService(({ onStop }) => {
              created++;
              onStop(() => pending.promise);
              throw new Error('offline');
            }),
          },
        }),
      ],
    },
    { failures: 'isolate' },
  );
  controller.mount();
  await turn();
  const stopping = controller.stop();
  pending.resolve();
  await stopping;
  await assert.rejects(controller.ready, /stopped/);
  assert.equal(created, 1);
  assert.equal(controller.get().phase, 'stopped');
});

test('controller stop is idempotent even when a status subscriber calls stop again', async () => {
  const controller = createRuntimeController({});
  controller.mount();
  await controller.ready;
  let nested;
  const off = controller.subscribe(() => {
    if (controller.get().phase === 'stopping') nested = controller.stop();
  });
  const completion = controller.stop();
  await completion;
  off();
  assert.equal(nested, completion);
});

test('action-only plugins wait for explicit and service dependencies; borrowed services stay host-owned', async () => {
  const pending = gate();
  const runtime = createRuntime(
    {
      plugins: [
        definePlugin({ id: 'explicit', dependencies: ['slow'] }),
        definePlugin({
          id: 'implicit',
          actions: { run: defineAction({ requires: ['slow.value'], execute() {} }) },
        }),
        definePlugin({
          id: 'slow',
          services: {
            value: defineService(({ onStart }) => {
              onStart(() => pending.promise);
              return {};
            }),
          },
        }),
      ],
    },
    { services: { host: {} } },
  );
  const stop = runtime.mount();
  for (const id of ['explicit', 'implicit'])
    assert.equal(
      runtime.lifecycle.get().plugins.find((entry) => entry.id === id).phase,
      'starting',
    );
  assert.equal(
    runtime.lifecycle.get().services.some((entry) => entry.id === 'host'),
    false,
  );
  pending.resolve();
  await runtime.ready;
  for (const id of ['explicit', 'implicit'])
    assert.equal(runtime.lifecycle.get().plugins.find((entry) => entry.id === id).phase, 'ready');
  await stop();
});

test('async lifecycle observers and failing diagnostics never break startup or cleanup', async () => {
  const controller = createRuntimeController({});
  const original = console.error;
  console.error = () => {
    throw new Error('broken reporter');
  };
  const off = controller.subscribe(async () => {
    throw new Error('async host observer');
  });
  const unwatch = controller.get().runtime.lifecycle.watch(async () => {
    throw new Error('async state observer');
  });
  try {
    controller.mount();
    await controller.ready;
    await controller.stop();
    await turn();
    assert.equal(controller.get().phase, 'stopped');
  } finally {
    off();
    unwatch();
    console.error = original;
  }
});
