import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionFailure,
  ActionStatus,
  createRuntime,
  defineAction,
  definePlugin,
  isActionFailure,
} from '../dist/core.js';

function mount(actions, messages = {}) {
  const runtime = createRuntime({ plugins: [definePlugin({ id: 'todos', actions })] });
  const translate = Object.assign(
    (key, values) => {
      assert.ok(Object.hasOwn(messages, key), `a missing key reached the translator: ${key}`);
      return messages[key].replace('{title}', values?.title ?? '');
    },
    { has: (key) => Object.hasOwn(messages, key) },
  );
  runtime.setTranslations(translate);
  const notifications = [];
  runtime.setNotifier((message, kind) => notifications.push([kind, message]));
  const stop = runtime.mount();
  return { runtime, actions: runtime.actions, notifications, stop };
}
const tick = () => new Promise((resolve) => setTimeout(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('defaults: success is silent, failure shows the error message once and the status reflects the outcome', async () => {
  const boom = new Error('Disk full');
  const { actions, notifications, stop } = mount({
    save: defineAction({
      execute: ({ input }) => {
        if (input === 'fail') throw boom;
        return 42;
      },
    }),
  });
  try {
    assert.deepEqual(await actions.execute('todos.save'), { status: 'completed', value: 42 });
    assert.deepEqual(notifications, []);
    assert.equal(actions.get('todos.save').status, ActionStatus.Succeeded);
    await assert.rejects(actions.execute('todos.save', 'fail'), (error) => {
      assert.ok(isActionFailure(error));
      assert.ok(error instanceof ActionFailure);
      assert.equal(error.feedback, 'Disk full');
      assert.equal(error.message, 'Disk full');
      assert.equal(error.cause, boom);
      return true;
    });
    await tick();
    assert.deepEqual(notifications, [['failure', 'Disk full']]);
    assert.equal(actions.get('todos.save').status, ActionStatus.Failed);
    assert.equal(actions.get('todos.save').error.cause, boom);
    assert.equal(actions.get('todos.save').pending, false);
  } finally {
    await stop();
  }
});

test('<id>.success and <id>.failure catalog keys are used automatically when the translator has them', async () => {
  const { actions, notifications, stop } = mount(
    {
      save: defineAction({
        execute: ({ input }) => {
          if (input === 'fail') throw new Error('Secret');
          return 1;
        },
      }),
    },
    { 'todos.save.success': 'Gespeichert', 'todos.save.failure': 'Speichern fehlgeschlagen' },
  );
  try {
    await actions.execute('todos.save');
    await assert.rejects(
      actions.execute('todos.save', 'fail'),
      (error) => error.feedback === 'Speichern fehlgeschlagen' && !/Secret/.test(error.message),
    );
    await tick();
    assert.deepEqual(notifications, [
      ['success', 'Gespeichert'],
      ['failure', 'Speichern fehlgeschlagen'],
    ]);
  } finally {
    await stop();
  }
});

test('explicit feedback: literals, keys, callbacks with result/input/error, false for silence, undefined falls back', async () => {
  const original = new Error('business failure');
  const { actions, notifications, stop } = mount(
    {
      literal: defineAction({ execute: () => 1, success: 'Saved' }),
      keyed: defineAction({ execute: () => 2, success: { messageKey: 'custom' } }),
      callback: defineAction({
        execute: ({ input }) => input * 2,
        success: ({ result, input }) => `${input} → ${result}`,
        failure: () => undefined,
      }),
      silent: defineAction({
        execute: () => {
          throw original;
        },
        success: false,
        failure: false,
      }),
      retry: defineAction({
        execute: () => {
          throw original;
        },
        failure: ({ error, input }) => (error === original ? `Try again with ${input}` : false),
      }),
      broken: defineAction({
        execute: () => 3,
        success: () => {
          throw new Error('broken feedback');
        },
      }),
      fallback: defineAction({
        execute: () => {
          throw new Error('Visible');
        },
        failure: () => undefined,
      }),
    },
    { custom: 'Fertig', 'todos.broken.success': 'Standard' },
  );
  try {
    await actions.execute('todos.literal');
    await actions.execute('todos.keyed');
    await actions.execute('todos.callback', 4);
    await assert.rejects(
      actions.execute('todos.silent'),
      (error) =>
        error.feedback === false && error.cause === original && error.message === 'Action failed.',
    );
    await assert.rejects(
      actions.execute('todos.retry', 'x'),
      (error) => error.feedback === 'Try again with x',
    );
    assert.deepEqual(await actions.execute('todos.broken'), { status: 'completed', value: 3 });
    assert.equal(actions.get('todos.broken').status, ActionStatus.Succeeded);
    await assert.rejects(
      actions.execute('todos.fallback'),
      (error) => error.feedback === 'Visible',
    );
    await tick();
    assert.deepEqual(notifications, [
      ['success', 'Saved'],
      ['success', 'Fertig'],
      ['success', '4 → 8'],
      ['failure', 'Try again with x'],
      ['success', 'Standard'],
      ['failure', 'Visible'],
    ]);
  } finally {
    await stop();
  }
});

test('in production the default failure message hides error details', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { actions, notifications, stop } = mount({
      fail: defineAction({
        execute: () => {
          throw new Error('Secret');
        },
      }),
    });
    try {
      await assert.rejects(
        actions.execute('todos.fail'),
        (error) => error.feedback === 'Something went wrong.',
      );
      await tick();
      assert.deepEqual(notifications, [['failure', 'Something went wrong.']]);
    } finally {
      await stop();
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('a failing notifier never changes the outcome; remounting installs exactly one failure observer', async () => {
  const original = new Error('business failure');
  let fails = false;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          notify: defineAction({
            success: ({ result }) => `saved:${result}`,
            failure: ({ error }) => (error === original ? 'Try again' : false),
            execute() {
              if (fails) throw original;
              return 7;
            },
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  const received = [];
  const remove = runtime.setNotifier((message, kind) => {
    received.push([kind, message]);
    return Promise.reject(new Error('renderer failed'));
  });
  assert.equal((await runtime.actions.execute('todos.notify')).value, 7);
  fails = true;
  await assert.rejects(
    runtime.actions.execute('todos.notify'),
    (error) => error.cause === original,
  );
  await tick();
  assert.deepEqual(received, [
    ['success', 'saved:7'],
    ['failure', 'Try again'],
  ]);
  remove();
  await assert.rejects(runtime.actions.execute('todos.notify'));
  assert.equal(received.length, 2);
  await stop();
  const again = runtime.mount();
  runtime.setNotifier((message, kind) => received.push([kind, message]));
  await assert.rejects(runtime.actions.execute('todos.notify'));
  assert.equal(received.length, 3, 'remount installs exactly one failure observer');
  await again();
});

test('late completion after unmount neither notifies nor touches the replacement registration', async () => {
  const gate = deferred();
  let calls = 0;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          slow: defineAction({
            execute: () => gate.promise,
            success: () => {
              calls++;
              return 'Done';
            },
          }),
        },
      }),
    ],
  });
  const notifications = [];
  runtime.setNotifier((message) => notifications.push(message));
  const stop = runtime.mount();
  const pending = runtime.actions.execute('todos.slow');
  assert.equal(runtime.actions.get('todos.slow').pending, true);
  const stopping = stop();
  assert.throws(() => runtime.mount(), /lifecycle transition/);
  gate.resolve('late');
  await stopping;
  const again = runtime.mount();
  assert.equal((await pending).value, 'late');
  assert.equal(calls, 0);
  assert.deepEqual(notifications, []);
  assert.equal(runtime.actions.get('todos.slow').pending, false);
  assert.equal(runtime.actions.get('todos.slow').status, ActionStatus.Idle);
  await again();
});
