import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  ActionFailure,
  createRuntime,
  defineAction,
  definePlugin,
  isActionFailure,
} from '../dist/core.js';

const standard = (validate) => ({ '~standard': { version: 1, vendor: 'test', validate } });
const tick = () => new Promise((resolve) => setTimeout(resolve));

test('a schema disables the action while the current input is invalid and hands execute the parsed value', async () => {
  const received = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          add: defineAction({
            input: z.string().trim().min(1),
            execute: ({ input }) => {
              received.push(input);
              return input.length;
            },
          }),
        },
      }),
    ],
  });
  const notifications = [];
  runtime.setNotifier((message, kind) => notifications.push([kind, message]));
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    assert.equal(actions.get('todos.add').enabled, false, 'no input is invalid input');
    assert.equal(actions.resolve('todos.add', '').enabled, false);
    assert.equal(actions.resolve('todos.add', '   ').enabled, false);
    assert.equal(actions.resolve('todos.add', 42).enabled, false);
    assert.equal(actions.resolve('todos.add', 'Milk').enabled, true);
    assert.deepEqual(await actions.execute('todos.add', ''), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.deepEqual(await actions.execute('todos.add', 42), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.deepEqual(await actions.execute('todos.add', '  Milk '), {
      status: 'completed',
      value: 4,
    });
    assert.deepEqual(received, ['Milk']);
    assert.deepEqual(notifications, []);
  } finally {
    stop();
  }
});

test('an explicit enabled keeps the action available; invalid input then fails with ActionFailure and one toast', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          add: defineAction({
            input: z.object({ title: z.string().min(1) }),
            enabled: true,
            execute: ({ input }) => input.title,
          }),
        },
      }),
    ],
  });
  const notifications = [];
  runtime.setNotifier((message, kind) => notifications.push([kind, message]));
  const stop = runtime.mount();
  try {
    assert.equal(runtime.actions.resolve('todos.add', { title: '' }).enabled, true);
    await assert.rejects(runtime.actions.execute('todos.add', { title: '' }), (error) => {
      assert.ok(isActionFailure(error));
      assert.ok(error instanceof ActionFailure);
      assert.ok(Array.isArray(error.cause.issues), 'the schema error is the cause');
      assert.equal(typeof error.feedback, 'string');
      return true;
    });
    await tick();
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0][0], 'failure');
    assert.equal(runtime.actions.get('todos.add').pending, false);
    assert.equal((await runtime.actions.execute('todos.add', { title: 'Milk' })).value, 'Milk');
    assert.equal(notifications.length, 1, 'success stays silent by default');
  } finally {
    stop();
  }
});

test('Standard Schema validators gate presentation when synchronous and always guard execution', async () => {
  const positive = standard((value) =>
    typeof value === 'number' && value > 0
      ? { value }
      : { issues: [{ message: 'Expected a positive number' }] },
  );
  const shout = standard(async (value) =>
    typeof value === 'string'
      ? { value: value.toUpperCase() }
      : { issues: [{ message: 'Expected a string' }] },
  );
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          double: defineAction({ input: positive, execute: ({ input }) => input * 2 }),
          shout: defineAction({ input: shout, execute: ({ input }) => input }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.actions.resolve('demo.double', -1).enabled, false);
    assert.equal(runtime.actions.resolve('demo.double', 2).enabled, true);
    assert.deepEqual(await runtime.actions.execute('demo.double', 2), {
      status: 'completed',
      value: 4,
    });
    assert.deepEqual(await runtime.actions.execute('demo.double', -1), {
      status: 'skipped',
      reason: 'disabled',
    });
    // Asynchronous validators cannot decide presentation; execution still validates.
    assert.equal(runtime.actions.resolve('demo.shout', 5).enabled, true);
    assert.deepEqual(await runtime.actions.execute('demo.shout', 'hi'), {
      status: 'completed',
      value: 'HI',
    });
    await assert.rejects(
      runtime.actions.execute('demo.shout', 5),
      (error) =>
        isActionFailure(error) && /Invalid input: Expected a string/.test(error.cause.message),
    );
  } finally {
    stop();
  }
});

test('a schema and a dynamic enabled compose: enabled decides, the schema still validates on execute', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          save: defineAction({
            input: z.number().int(),
            enabled: ({ input }) => input !== 13,
            execute: ({ input }) => input,
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.actions.resolve('demo.save', 13).enabled, false);
    assert.equal(
      runtime.actions.resolve('demo.save', 1.5).enabled,
      true,
      'an explicit enabled is not combined with the schema',
    );
    assert.deepEqual(await runtime.actions.execute('demo.save', 13), {
      status: 'skipped',
      reason: 'disabled',
    });
    await assert.rejects(runtime.actions.execute('demo.save', 1.5), isActionFailure);
    assert.equal((await runtime.actions.execute('demo.save', 2)).value, 2);
  } finally {
    stop();
  }
});
