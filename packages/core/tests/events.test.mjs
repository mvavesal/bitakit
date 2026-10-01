import test from 'node:test';
import assert from 'node:assert/strict';
import { EventService, FoundationRuntime, createActionList, defineAction } from '../dist/core.js';
import todos from '../examples/todos/plugin.mjs';

test('typed event envelopes carry payloads; multi-watch is OR, duplicates are ignored', () => {
  const events = new EventService();
  const received = [];
  const stop = events.watch(['a', 'b', 'a'], (event) => received.push(event));
  events.emit('a', { id: 42 });
  events.emit('b');
  events.emit('other');
  assert.deepEqual(received, [
    { type: 'a', data: { id: 42 } },
    { type: 'b', data: undefined },
  ]);
  assert.equal(events.subscriptionCount, 1);
  stop();
  stop();
  events.emit('a');
  assert.equal(received.length, 2);
  assert.equal(events.subscriptionCount, 0);
  const literal = events.watch('*', (event) => received.push(event));
  events.emit('unrelated');
  assert.equal(received.length, 2);
  events.emit('*');
  assert.equal(received.length, 3);
  literal();
});

test('sync errors and async rejections are reported without interrupting other handlers', async () => {
  const errors = [];
  const events = new EventService((error, event) => errors.push([error.message, event.type]));
  let calls = 0;
  events.watch('a', () => {
    throw new Error('sync');
  });
  events.watch('a', async () => {
    throw new Error('async');
  });
  events.watch('a', () => {
    calls++;
  });
  events.emit('a');
  assert.equal(calls, 1);
  await Promise.resolve();
  assert.deepEqual(errors, [
    ['sync', 'a'],
    ['async', 'a'],
  ]);
  events.clear();
  assert.equal(events.subscriptionCount, 0);
});

test('unsubscribe suppresses callbacks already in the dispatch snapshot and aborts async work', async () => {
  const events = new EventService();
  let signal,
    resume,
    calls = 0;
  events.watch('a', () => stopSecond());
  const stopSecond = events.watch('a', () => calls++);
  events.emit('a');
  assert.equal(calls, 0);
  const stopAsync = events.watch('async', async (_, context) => {
    signal = context.signal;
    await new Promise((resolve) => {
      resume = resolve;
    });
    if (!signal.aborted) calls++;
  });
  events.emit('async');
  stopAsync();
  assert.equal(signal.aborted, true);
  resume();
  await Promise.resolve();
  assert.equal(calls, 0);
  events.clear();
});

test('Todo service events disable deletion when the last item is removed; remounts do not leak', async () => {
  const actions = createActionList();
  const runtime = new FoundationRuntime(actions, { plugins: [todos] });
  for (let iteration = 0; iteration < 30; iteration++) {
    const stop = runtime.mount();
    assert.equal(runtime.events.subscriptionCount, 1);
    assert.equal(actions.get('todos.delete').enabled, false);
    const result = await actions.execute('todos.create', 'Example');
    assert.equal(actions.get('todos.delete').enabled, true);
    await actions.execute('todos.delete', result.value.id);
    assert.equal(actions.get('todos.delete').enabled, false);
    assert.deepEqual(await actions.execute('todos.delete', result.value.id), {
      status: 'skipped',
      reason: 'disabled',
    });
    stop();
    stop();
    assert.equal(runtime.events.subscriptionCount, 0);
  }
});

test('setup failure rolls back listeners, registrations and services', () => {
  let signal,
    disposed = 0;
  const actions = createActionList();
  const runtime = new FoundationRuntime(actions, {
    services: [
      {
        id: 'source',
        create: ({ events }) => {
          events.watch('source', () => {});
          return {};
        },
        dispose: () => disposed++,
      },
    ],
    actions: [
      defineAction({
        id: 'broken',
        setup({ events }) {
          events.watch('a', (_, context) => {
            signal = context.signal;
          });
          events.emit('a');
          throw new Error('setup failed');
        },
      }),
    ],
  });
  assert.throws(() => runtime.mount(), /setup failed/);
  assert.equal(runtime.events.subscriptionCount, 0);
  assert.equal(signal.aborted, true);
  assert.equal(actions.get('broken'), undefined);
  assert.equal(disposed, 1);
});

test('removed action async completion cannot mutate its replacement or emit stale events', async () => {
  let finish;
  const actions = createActionList();
  const runtime = new FoundationRuntime(actions, {
    actions: [
      defineAction({
        id: 'example',
        setup({ events, action }) {
          events.watch('load', async () => {
            await new Promise((resolve) => {
              finish = resolve;
            });
            action.enabled = false;
            events.emit('finished');
          });
        },
      }),
    ],
  });
  let stop = runtime.mount();
  runtime.events.emit('load');
  stop();
  stop = runtime.mount();
  let finished = 0;
  runtime.events.watch('finished', () => {
    finished++;
  });
  finish();
  await Promise.resolve();
  assert.equal(actions.get('example').enabled, true);
  assert.equal(finished, 0);
  stop();
});

test('runtime event buses are isolated and disposing an ActionList removes action listeners', () => {
  const definition = defineAction({
    id: 'example',
    setup({ events, action }) {
      events.watch('disable', () => {
        action.enabled = false;
      });
    },
  });
  const a = new FoundationRuntime(createActionList(), { actions: [definition] });
  const b = new FoundationRuntime(createActionList(), { actions: [definition] });
  const stopA = a.mount(),
    stopB = b.mount();
  a.app.events.emit('disable');
  assert.equal(a.actions.get('example').enabled, false);
  assert.equal(b.actions.get('example').enabled, true);
  a.actions.dispose();
  assert.equal(a.events.subscriptionCount, 0);
  stopA();
  stopB();
});

test('registration cleanup runs once, all cleanups run even after an error', () => {
  const actions = createActionList();
  const registration = actions.register({ id: 'a', title: 'A' });
  let count = 0;
  registration.onDispose(() => count++);
  registration.onDispose(() => {
    throw new Error('failure');
  });
  assert.throws(() => registration.unregister(), AggregateError);
  registration.unregister();
  assert.equal(count, 1);
  assert.equal(registration.get(), undefined);
  const replacement = actions.register({ id: 'a', title: 'New' });
  assert.equal(registration.update({ enabled: false }), false);
  assert.equal(replacement.get().enabled, true);
  actions.dispose();
});

test('declarative events deliver payloads before setup, share context and clean up after failure', async () => {
  const seen = [], errors = [];
  let savedAction, signal;
  const runtime = new FoundationRuntime(createActionList(), {
    onEventError: error => errors.push(error.message),
    actions: [defineAction({
      id: 'declarative',
      events: ['text.changed', 'loaded'],
      setup({ events }) { events.emit('loaded', 'initial'); },
      async onEvent(event, context) {
        signal = context.signal;
        savedAction = context.action;
        seen.push(event);
        context.action.enabled = event.data !== '';
        if (event.type === 'text.changed') throw new Error('handler failure');
      },
    })],
  });
  const stop = runtime.mount();
  assert.deepEqual(seen, [{ type: 'loaded', data: 'initial' }]);
  runtime.events.emit('text.changed', '');
  assert.equal(runtime.actions.get('declarative').enabled, false);
  await Promise.resolve();
  assert.deepEqual(errors, ['handler failure']);
  stop();
  assert.equal(signal.aborted, true);
  assert.equal(runtime.events.subscriptionCount, 0);
  assert.equal(savedAction.get(), undefined);
  runtime.events.emit('loaded', 'after');
  assert.equal(seen.length, 2);

  const broken = new FoundationRuntime(createActionList(), {
    actions: [defineAction({
      id: 'broken', events: ['a'], onEvent() {},
      setup() { throw new Error('broken setup'); },
    })],
  });
  assert.throws(() => broken.mount(), /broken setup/);
  assert.equal(broken.events.subscriptionCount, 0);
});
