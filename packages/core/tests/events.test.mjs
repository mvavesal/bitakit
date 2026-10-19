import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EventService,
  createRuntime,
  defineAction,
  defineEvents,
  definePlugin,
  defineService,
  event,
  isEventsDefinition,
  isBitaKitStartupError,
} from '../dist/core.js';
import todos from '../examples/todos/plugin.mjs';

test('on delivers envelopes; lists are OR, duplicates are ignored, "*" and "<prefix>.*" are patterns', async () => {
  const events = new EventService();
  const received = [];
  const stop = events.on(['a', 'b', 'a'], (event) => received.push(event));
  events.emit('a', { id: 42 });
  events.emit('b');
  events.emit('other');
  assert.deepEqual(received, [
    { type: 'a', data: { id: 42 } },
    { type: 'b', data: undefined },
  ]);
  assert.equal(events.subscriptionCount, 1);
  await stop();
  await stop();
  events.emit('a');
  assert.equal(received.length, 2);
  assert.equal(events.subscriptionCount, 0);
  const all = [];
  const scoped = [];
  const stopAll = events.on('*', (event) => all.push(event.type));
  const stopScoped = events.on('todos.*', (event) => scoped.push(event.type));
  events.emit('todos.changed');
  events.emit('notes.changed');
  events.emit('todosx');
  assert.deepEqual(all, ['todos.changed', 'notes.changed', 'todosx']);
  assert.deepEqual(scoped, ['todos.changed']);
  stopAll();
  stopScoped();
  assert.equal(events.subscriptionCount, 0);
});

test('sync errors and async rejections are reported without interrupting other handlers', async () => {
  const errors = [];
  const events = new EventService((error, event) => errors.push([error.message, event.type]));
  let calls = 0;
  events.on('a', () => {
    throw new Error('sync');
  });
  events.on('a', async () => {
    throw new Error('async');
  });
  events.on('a', () => {
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
  events.on('a', () => stopSecond());
  const stopSecond = events.on('a', () => calls++);
  events.emit('a');
  assert.equal(calls, 0);
  const stopAsync = events.on('async', async (_, context) => {
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

test('defineEvents declares plugin events: prefixed names, owner-only emit, cancelable results and payload schemas', async () => {
  const errors = [];
  const seen = [];
  const tag = {
    parse: (value) => {
      if (typeof value !== 'string') throw new Error('tag must be a string');
      return value.toLowerCase();
    },
  };
  const library = defineEvents({
    opened: event(),
    closing: event({ cancelable: true }),
    tagged: event({ schema: tag }),
  });
  assert.ok(isEventsDefinition(library));
  assert.equal(library.events.closing.cancelable, true);
  assert.equal(library.events.opened.cancelable, false);
  assert.throws(() => defineEvents({ 'a.b': event() }), /Invalid event name "a\.b"/);
  const runtime = createRuntime({
    onEventError: (error, event) => errors.push([event.type, error.message]),
    plugins: [
      definePlugin({
        id: 'library',
        events: library,
        services: {
          doors: defineService(({ events }) => ({
            open: () => events.emit('library.opened', { at: 1 }),
            close: (reason) => events.emit('library.closing', { reason }),
            tag: (value) => events.emit('library.tagged', value),
          })),
        },
      }),
      definePlugin({
        id: 'visitor',
        services: {
          bell: defineService(({ events }) => ({ ring: () => events.emit('library.closing') })),
        },
        actions: {
          intrude: defineAction({ execute: ({ events }) => events.emit('library.opened') }),
          announce: defineAction({
            execute: ({ events }) => events.emit('visitor.arrived', 'guest'),
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    const observed = [];
    const unobserve = runtime.events.observe((event) => observed.push(event.type));
    runtime.events.on('library.opened', (event) => seen.push(['opened', event.data]));
    runtime.events.on('library.*', (event) => seen.push(['any', event.type]));
    assert.equal(runtime.services.library.doors.open(), undefined, 'plain events return nothing');
    assert.deepEqual(seen, [
      ['opened', { at: 1 }],
      ['any', 'library.opened'],
    ]);
    // Cancelable: emit waits for the handlers and resolves to whether none cancelled.
    const pending = runtime.services.library.doors.close('day');
    assert.ok(pending instanceof Promise);
    assert.equal(await pending, true);
    const off = runtime.events.on('library.closing', async (event) => {
      await Promise.resolve();
      if (event.data.reason === 'night') event.cancel();
    });
    assert.equal(await runtime.services.library.doors.close('night'), false);
    assert.equal(await runtime.services.library.doors.close('day'), true);
    off();
    // Payload schemas parse on emit.
    runtime.events.on('library.tagged', (event) => seen.push(['tag', event.data]));
    runtime.services.library.doors.tag('HELLO');
    assert.deepEqual(
      seen.filter(([kind]) => kind === 'tag'),
      [['tag', 'hello']],
    );
    assert.throws(() => runtime.services.library.doors.tag(1), /tag must be a string/);
    // Only the declaring plugin emits into its namespace; everyone may listen.
    await assert.rejects(runtime.actions.execute('visitor.intrude'), (error) => {
      assert.match(
        error.cause.message,
        /"visitor" cannot emit "library\.opened": that event belongs to plugin "library"/,
      );
      return true;
    });
    assert.throws(() => runtime.services.visitor.bell.ring(), /belongs to plugin "library"/);
    // Undeclared names stay free for everyone.
    const arrived = [];
    runtime.events.on('visitor.arrived', (event) => arrived.push(event.data));
    await runtime.actions.execute('visitor.announce');
    assert.deepEqual(arrived, ['guest']);
    assert.deepEqual(errors, []);
    for (const type of ['library.opened', 'library.closing', 'library.tagged', 'visitor.arrived'])
      assert.ok(observed.includes(type), `observed ${type}`);
    unobserve();
  } finally {
    await stop();
  }
});

test('the todos example: store-driven enabled state and declared events, with leak-free remounts', async () => {
  const runtime = createRuntime({ plugins: [todos] });
  const { actions } = runtime;
  for (let iteration = 0; iteration < 20; iteration++) {
    const changes = [];
    const stop = runtime.mount();
    const off = runtime.events.on('todos.changed', (event) => changes.push(event.data));
    assert.equal(actions.get('todos.delete').enabled, false);
    const created = await actions.execute('todos.create', 'Example');
    assert.equal(actions.get('todos.delete').enabled, true);
    assert.deepEqual((await actions.execute('todos.all')).value, [created.value]);
    await actions.execute('todos.delete', created.value.id);
    assert.equal(actions.get('todos.delete').enabled, false);
    assert.deepEqual(await actions.execute('todos.delete', created.value.id), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.deepEqual(changes, [
      { kind: 'added', id: created.value.id },
      { kind: 'removed', id: created.value.id },
    ]);
    off();
    await stop();
    await stop();
    await runtime.stopped;
    assert.equal(runtime.events.subscriptionCount, 0);
    assert.equal(actions.get('todos.create'), undefined);
  }
});

test('a failing setup releases listeners, aborts handler signals and stops services', async () => {
  let signal,
    stopped = 0;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'broken',
        events: defineEvents({ ping: event() }),
        services: {
          source: defineService(({ events, onStop }) => {
            events.on('broken.ping', (_, context) => {
              signal = context.signal;
            });
            events.emit('broken.ping');
            onStop(() => stopped++);
            return {};
          }),
        },
        actions: { run: defineAction({ execute() {} }) },
        setup: () => {
          throw new Error('setup failed');
        },
      }),
    ],
  });
  assert.throws(
    () => runtime.mount(),
    (error) =>
      isBitaKitStartupError(error) &&
      error.plugin === 'broken' &&
      /Setup in plugin "broken" failed to start: setup failed/.test(error.message),
  );
  await runtime.stopped;
  assert.equal(runtime.events.subscriptionCount, 0);
  assert.equal(signal.aborted, true);
  assert.equal(stopped, 1);
  assert.equal(runtime.actions.get('broken.run'), undefined);
});

test('each runtime has its own bus; stopping releases the listeners of its services', async () => {
  const flag = definePlugin({
    id: 'flag',
    events: defineEvents({ off: event() }),
    services: {
      state: defineService(({ events, store }) => {
        const state = store({ on: true });
        events.on('flag.off', () => state.set({ on: false }));
        return { state };
      }),
    },
    actions: {
      toggle: defineAction({
        enabled: ({ services }) => services.flag.state.state.get().on,
        execute() {},
      }),
    },
  });
  const a = createRuntime({ plugins: [flag] });
  const b = createRuntime({ plugins: [flag] });
  const stopA = a.mount();
  const stopB = b.mount();
  assert.equal(a.events.subscriptionCount, 1);
  a.events.emit('flag.off');
  assert.equal(a.actions.get('flag.toggle').enabled, false);
  assert.equal(b.actions.get('flag.toggle').enabled, true);
  await stopA();
  assert.equal(a.events.subscriptionCount, 0);
  assert.equal(b.events.subscriptionCount, 1);
  await stopB();
});

test('a cancelable event rejects instead of throwing when its payload fails the schema', async () => {
  const name = {
    parse: (value) => {
      if (typeof value !== 'string') throw new Error('name must be a string');
      return value;
    },
  };
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'files',
        events: defineEvents({ deleting: event({ cancelable: true, schema: name }) }),
        services: {
          store: defineService(({ events }) => ({
            remove: (file) => events.emit('files.deleting', file),
          })),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    let pending;
    assert.doesNotThrow(() => {
      pending = runtime.services.files.store.remove(1);
    });
    await assert.rejects(pending, /name must be a string/);
    assert.equal(await runtime.services.files.store.remove('notes.txt'), true);
  } finally {
    await stop();
  }
});
