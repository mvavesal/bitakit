import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionStatus, createRuntime, defineAction, definePlugin } from '../dist/core.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

test('pending is set only for asynchronous work; synchronous handlers never show pending', async () => {
  const gate = deferred();
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          sync: defineAction({ execute: () => 'now' }),
          async: defineAction({ execute: () => gate.promise }),
        },
      }),
    ],
  });
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    const seen = [];
    const off = actions.subscribe(() => seen.push(actions.get('demo.sync')?.pending));
    assert.deepEqual(await actions.execute('demo.sync'), { status: 'completed', value: 'now' });
    assert.equal(seen.includes(true), false);
    assert.equal(actions.get('demo.sync').status, ActionStatus.Succeeded);
    const run = actions.execute('demo.async');
    assert.equal(actions.get('demo.async').pending, true);
    assert.deepEqual(actions.get('demo.async').pendingKeys, ['*']);
    assert.equal(actions.get('demo.async').status, ActionStatus.Pending);
    gate.resolve(5);
    assert.equal((await run).value, 5);
    assert.equal(actions.get('demo.async').pending, false);
    assert.deepEqual(actions.get('demo.async').pendingKeys, []);
    assert.equal(actions.get('demo.async').status, ActionStatus.Succeeded);
    off();
  } finally {
    stop();
  }
});

test('exclusive skips while running; per-input tracks each input; latest aborts the previous run', async () => {
  const gates = new Map();
  const wait = (key) => {
    const gate = deferred();
    gates.set(key, gate);
    return gate.promise;
  };
  const aborted = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          exclusive: defineAction({ execute: ({ input }) => wait(`exclusive:${input}`) }),
          perInput: defineAction({
            concurrency: 'per-input',
            execute: ({ input }) => wait(`per:${input}`),
          }),
          keyed: defineAction({
            concurrency: 'per-input',
            concurrencyKey: (input) => input.id,
            execute: ({ input }) => wait(`keyed:${input.id}`),
          }),
          latest: defineAction({
            concurrency: 'latest',
            execute: ({ input, signal }) => {
              signal.addEventListener('abort', () => aborted.push(input));
              return wait(`latest:${input}`);
            },
          }),
        },
      }),
    ],
  });
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    const first = actions.execute('demo.exclusive', 1);
    assert.deepEqual(await actions.execute('demo.exclusive', 2), {
      status: 'skipped',
      reason: 'pending',
    });
    gates.get('exclusive:1').resolve('one');
    assert.equal((await first).value, 'one');

    const a = actions.execute('demo.perInput', 'a');
    const b = actions.execute('demo.perInput', 'b');
    assert.deepEqual(actions.get('demo.perInput').pendingKeys, ['a', 'b']);
    assert.deepEqual(await actions.execute('demo.perInput', 'a'), {
      status: 'skipped',
      reason: 'pending',
    });
    gates.get('per:a').resolve();
    await a;
    assert.deepEqual(actions.get('demo.perInput').pendingKeys, ['b']);
    assert.equal(actions.get('demo.perInput').pending, true);
    gates.get('per:b').resolve();
    await b;
    assert.equal(actions.get('demo.perInput').pending, false);

    const keyed = actions.execute('demo.keyed', { id: 'x', revision: 1 });
    assert.deepEqual(actions.get('demo.keyed').pendingKeys, ['x']);
    assert.deepEqual(await actions.execute('demo.keyed', { id: 'x', revision: 2 }), {
      status: 'skipped',
      reason: 'pending',
    });
    gates.get('keyed:x').resolve();
    await keyed;

    const stale = actions.execute('demo.latest', 'q1');
    const fresh = actions.execute('demo.latest', 'q2');
    assert.deepEqual(
      aborted,
      ['q1'],
      'the newer run aborts the previous signal, whatever the input',
    );
    assert.equal(actions.get('demo.latest').pending, true);
    gates.get('latest:q1').resolve('stale');
    assert.equal((await stale).value, 'stale', 'a superseded run still returns to its own caller');
    assert.equal(
      actions.get('demo.latest').pending,
      true,
      'the newest run keeps the action pending',
    );
    gates.get('latest:q2').resolve('fresh');
    assert.equal((await fresh).value, 'fresh');
    assert.equal(actions.get('demo.latest').pending, false);
    assert.equal(actions.get('demo.latest').status, ActionStatus.Succeeded);
  } finally {
    stop();
  }
});

test('the execution signal aborts when the registration is disposed; late results do not touch state', async () => {
  let signal;
  const gate = deferred();
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          run: defineAction({
            execute: (context) => {
              signal = context.signal;
              return gate.promise;
            },
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  const run = runtime.actions.execute('demo.run');
  assert.equal(signal.aborted, false);
  stop();
  assert.equal(signal.aborted, true);
  gate.resolve('late');
  assert.equal((await run).value, 'late');
  assert.equal(runtime.actions.get('demo.run'), undefined);
});

test('confirm asks the host before running; declining skips with reason cancelled', async () => {
  const asked = [];
  let answer = true;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          clear: defineAction({ confirm: 'Clear everything?', execute: () => 'cleared' }),
          remove: defineAction({
            confirm: ({ input }) =>
              input.locked
                ? {
                    title: 'Remove locked item?',
                    description: `Item ${input.id}`,
                    destructive: true,
                  }
                : false,
            execute: ({ input }) => `removed:${input.id}`,
          }),
        },
      }),
    ],
  });
  const remove = runtime.setConfirm(async (request) => {
    asked.push(request);
    return answer;
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(await runtime.actions.execute('todos.clear'), {
      status: 'completed',
      value: 'cleared',
    });
    assert.deepEqual(asked, [{ title: 'Clear everything?', description: '' }]);
    answer = false;
    assert.deepEqual(await runtime.actions.execute('todos.clear'), {
      status: 'skipped',
      reason: 'cancelled',
    });
    assert.equal(runtime.actions.get('todos.clear').pending, false);
    assert.equal(
      runtime.actions.get('todos.clear').status,
      ActionStatus.Succeeded,
      'a cancelled run keeps the last status',
    );
    assert.equal(
      (await runtime.actions.execute('todos.remove', { id: 1, locked: false })).value,
      'removed:1',
    );
    assert.equal(asked.length, 2, 'a falsy confirm does not ask');
    assert.deepEqual(await runtime.actions.execute('todos.remove', { id: 2, locked: true }), {
      status: 'skipped',
      reason: 'cancelled',
    });
    assert.deepEqual(asked.at(-1), {
      title: 'Remove locked item?',
      description: 'Item 2',
      destructive: true,
    });
    remove();
    // Without a handler the runtime warns once and proceeds.
    const warnings = [];
    const warn = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      assert.equal((await runtime.actions.execute('todos.clear')).value, 'cleared');
      assert.equal((await runtime.actions.execute('todos.clear')).value, 'cleared');
    } finally {
      console.warn = warn;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /no confirmation handler/);
  } finally {
    stop();
  }
});

test('a declined confirmation of one action does not block other actions, and the confirm sees the input', async () => {
  const seen = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          purge: defineAction({
            confirm: ({ input, services }) => {
              seen.push([input, typeof services]);
              return { title: `Purge ${input}?`, description: '' };
            },
            execute: () => 'purged',
          }),
          other: defineAction({ execute: () => 'other' }),
        },
      }),
    ],
  });
  runtime.setConfirm(() => false);
  const stop = runtime.mount();
  try {
    assert.deepEqual(await runtime.actions.execute('todos.purge', 'all'), {
      status: 'skipped',
      reason: 'cancelled',
    });
    assert.deepEqual(seen, [['all', 'object']]);
    assert.equal((await runtime.actions.execute('todos.other')).value, 'other');
  } finally {
    stop();
  }
});
