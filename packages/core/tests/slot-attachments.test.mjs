import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  defineSlot,
  defineService,
  defineAction,
  PluginScope,
  createActionList,
  SlotError,
  pluginSlot,
} from '../dist/core.js';
import { SlotRuntime } from '../dist/slots/runtime.js';
import { createLifecycleState } from '../dist/lifecycle/state.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const component = () => defineSlot({ accepts: 'component' });

test('declarations remain unavailable until ready; require, wait and unknown names differ', async () => {
  const gate = deferred();
  let scope, handle;
  const runtime = createRuntime({
    plugins: [
      {
        id: 'owner',
        slots: { header: component() },
        services: {
          connection: defineService(({ onStart }) => {
            onStart(() => gate.promise);
            return {};
          }),
        },
        setup: ({ scope: app }) => {
          scope = app;
          assert.throws(
            () => app.slots.attach({ slot: 'owner.header', component: 'opaque' }),
            (e) => e.code === 'unavailable-slot',
          );
          assert.throws(
            () => app.slots.attach({ slot: 'typo', component: 'opaque' }, { availability: 'wait' }),
            (e) => e.code === 'unknown-slot',
          );
          handle = app.slots.attach(
            { slot: 'owner.header', component: 'opaque' },
            { availability: 'wait' },
          );
        },
      },
    ],
  });
  assert.equal(runtime.slots.get('owner.header').phase, 'idle');
  const stop = runtime.mount();
  assert.equal(handle.get().phase, 'pending');
  assert.equal(runtime.slots.get('owner.header').items.length, 0);
  gate.resolve();
  await runtime.ready;
  await handle.ready;
  const late = [];
  scope.slots.watch('owner.header', (state) => late.push(state));
  assert.equal(late[0].phase, 'ready');
  assert.equal(late[0].items[0].component, 'opaque');
  assert.equal(runtime.slots.get('owner.header'), runtime.slots.get('owner.header'));
  await stop();
  assert.equal(handle.get().phase, 'detached');
  assert.equal(runtime.slots.get('owner.header').items.length, 0);
  assert.throws(() => scope.slots, /no longer active/);
});

// Exercise owner-only transitions through the existing lifecycle state. Public plugin replacement
// is deliberately not introduced by this phase.
function isolated(definition = { accepts: 'component', policy: 'list' }) {
  const lifecycle = createLifecycleState(
    ['owner', 'writer'],
    [],
    () => {},
    () => {},
  );
  const list = createActionList();
  const events = [],
    errors = [];
  const registry = new SlotRuntime(
    [{ ...definition, id: 'surface', plugin: 'owner' }],
    lifecycle.state,
    list,
    (s) => events.push(s),
    (e) => errors.push(e),
  );
  const scope = new PluginScope(list, new Map());
  const slots = registry.bind(scope, 'writer');
  lifecycle.update({ generation: 1, phase: 'starting' });
  lifecycle.plugin('writer', 'ready');
  return { lifecycle, list, registry, scope, slots, events, errors };
}

test('owner loss and a new generation reattach once; contributor close revokes waiters', async () => {
  const x = isolated();
  const handle = x.slots.attach({ slot: 'surface', component: 'widget' }, { availability: 'wait' });
  const states = [];
  handle.watch((s) => states.push(s));
  x.lifecycle.plugin('owner', 'ready');
  await handle.ready;
  assert.equal(x.registry.reader.get('surface').items.length, 1);
  x.lifecycle.plugin('owner', 'stopped');
  assert.equal(handle.get().reason, 'owner-unavailable');
  assert.equal(x.registry.reader.get('surface').items.length, 0);
  x.lifecycle.update({ generation: 2 });
  x.lifecycle.plugin('owner', 'ready');
  assert.equal(handle.get().generation, 2);
  assert.equal(x.registry.reader.get('surface').items.length, 1);
  const snapshot = x.registry.reader.get('surface');
  x.lifecycle.update({ phase: 'ready' });
  assert.equal(
    x.registry.reader.get('surface'),
    snapshot,
    'unrelated state does not invalidate the snapshot',
  );
  let observations = 0;
  x.slots.watch('surface', () => observations++);
  x.scope.close();
  const afterClose = observations;
  assert.equal(handle.get().phase, 'detached');
  x.lifecycle.plugin('owner', 'stopped');
  x.lifecycle.plugin('owner', 'ready');
  assert.equal(observations, afterClose);
  assert.equal(x.registry.reader.get('surface').items.length, 0);
  handle.dispose();
  handle.dispose();
  await x.scope.dispose();
  assert.equal(states.at(-1).phase, 'detached');
  assert.throws(() => x.slots.attach({ slot: 'surface', component: 'late' }), /no longer active/);
});

test('single and keyed conflicts include pending reservations; dispose releases the reservation', async () => {
  for (const policy of ['single', 'keyed']) {
    const x = isolated({ accepts: 'component', policy });
    if (policy === 'keyed')
      assert.throws(
        () => x.slots.attach({ slot: 'surface', component: 1 }, { availability: 'wait' }),
        /requires a non-empty key/,
      );
    const first = x.slots.attach(
      { slot: 'surface', component: 1, key: 'main' },
      { availability: 'wait' },
    );
    assert.throws(
      () => x.slots.attach({ slot: 'surface', component: 2, key: 'main' }, { availability: 'wait' }),
      (e) => e instanceof SlotError && e.code === 'conflict',
    );
    first.dispose();
    await assert.rejects(first.ready, (e) => e.code === 'detached');
    const second = x.slots.attach(
      { slot: 'surface', component: 2, key: 'main' },
      { availability: 'wait' },
    );
    x.lifecycle.plugin('owner', 'ready');
    await second.ready;
    assert.equal(x.registry.reader.get('surface').items[0].component, 2);
    await x.scope.dispose();
  }
});

test('data is validated once, failures are attributed, and late validation cannot resurrect a closed scope', async () => {
  const gate = deferred();
  let calls = 0;
  const x = isolated({
    accepts: 'data',
    policy: 'single',
    schema: {
      '~standard': {
        validate: async (value) => {
          calls++;
          await gate.promise;
          return { value: { count: Number(value.count) } };
        },
      },
    },
  });
  x.lifecycle.plugin('owner', 'ready');
  const pending = x.slots.attach({ slot: 'surface', data: { count: '2' } });
  assert.equal(pending.get().reason, 'validating');
  gate.resolve();
  await pending.ready;
  assert.equal(calls, 1);
  assert.deepEqual(x.registry.reader.get('surface').items[0].data, { count: 2 });
  pending.dispose();
  const late = x.slots.attach({ slot: 'surface', data: { count: '3' } });
  x.scope.close();
  await assert.rejects(late.ready, (e) => e.code === 'detached');
  await Promise.resolve();
  assert.equal(x.registry.reader.get('surface').items.length, 0);

  const bad = isolated({
    accepts: 'data',
    policy: 'single',
    schema: {
      parse() {
        throw Error('count required');
      },
    },
  });
  bad.lifecycle.plugin('owner', 'ready');
  const failure = bad.slots.attach({ slot: 'surface', data: {} });
  await assert.rejects(
    failure.ready,
    (e) => e.plugin === 'writer' && /count required/.test(e.message),
  );
  assert.equal(failure.get().phase, 'failed');
  let terminal;
  failure.watch((s) => {
    terminal = s;
  });
  assert.equal(terminal.phase, 'failed');
  assert.doesNotThrow(
    () => bad.slots.attach({ slot: 'surface', data: {} }),
    'failed validation releases single occupancy',
  );
  await bad.scope.dispose();
  await x.scope.dispose();
});

test('action attachments reference the one live ActionList and exclude internal registrations', async () => {
  const x = isolated({ accepts: 'actions', policy: 'list' });
  x.lifecycle.plugin('owner', 'ready');
  const registration = x.list.register({ id: 'save', title: 'Save', execute() {} });
  const internal = x.list.register({ id: 'hidden', internal: true, execute() {} });
  assert.throws(() => x.slots.attach({ slot: 'surface', actionId: 'hidden' }), /public Action/);
  assert.throws(() => x.slots.attach({ slot: 'surface', actionId: 'missing' }), /public Action/);
  assert.throws(() => x.slots.attach({ slot: 'surface', component: 'wrong' }), /accepts actions/);
  const handle = x.slots.attach({ slot: 'surface', actionId: 'save' });
  await handle.ready;
  const snapshot = x.registry.reader.get('surface');
  registration.update({ title: 'Updated' });
  assert.equal(x.registry.reader.get('surface'), snapshot, 'presentation is not copied into slots');
  registration.unregister();
  assert.equal(handle.get().reason, 'action-unavailable');
  const replacement = x.list.register({ id: 'save', title: 'New', execute() {} });
  assert.equal(handle.get().phase, 'attached');
  await x.scope.dispose();
  replacement.unregister();
  internal.unregister();
});

test('declarative and programmatic contributions share ordering, ownership and remount cleanup', async () => {
  const handles = [];
  let scope;
  const runtime = createRuntime({
    slots: { header: component() },
    plugins: [
      {
        id: 'writer',
        ui: { slots: [pluginSlot({ default: 'file', order: 1 }, 'header', 'ui/slots/header.tsx')] },
        setup: ({ scope: app }) => {
          scope = app;
          handles.push(
            app.slots.attach({ slot: 'header', component: 'manual', order: 0 }, { availability: 'wait' }),
          );
        },
      },
    ],
  });
  runtime.mount();
  await runtime.ready;
  assert.deepEqual(
    runtime.slots.get('header').items.map((x) => x.component),
    ['manual', 'file'],
  );
  const late = scope.slots.attach({ slot: 'header', component: 'later', order: 1 });
  await late.ready;
  assert.deepEqual(
    runtime.slots.get('header').items.map((x) => x.component),
    ['manual', 'file', 'later'],
  );
  await runtime.stop();
  assert.equal(handles[0].get().phase, 'detached');
  runtime.mount();
  await runtime.ready;
  assert.equal(runtime.slots.get('header').generation, 2);
  assert.equal(runtime.slots.get('header').items.length, 2);
  handles[0].dispose();
  assert.equal(runtime.slots.get('header').items.length, 2);
  await runtime.stop();
});

test('observer errors and reentrant close cannot leave active or waiting contributions behind', async () => {
  const x = isolated();
  const handle = x.slots.attach({ slot: 'surface', component: 'widget' }, { availability: 'wait' });
  handle.watch((s) => {
    if (s.phase === 'attached') x.scope.close();
  });
  x.registry.reader.watch('surface', () => {
    throw Error('observer');
  });
  x.lifecycle.plugin('owner', 'ready');
  await assert.rejects(handle.ready, (e) => e.code === 'detached');
  assert.equal(handle.get().phase, 'detached');
  assert.equal(x.registry.reader.get('surface').items.length, 0);
  assert.ok(x.errors.length > 0);
  await x.scope.dispose();
});

test('startup failure revokes pending attachments; cleanup pending is never ready', async () => {
  let handle;
  const runtime = createRuntime({
    slots: { header: component() },
    services: {
      connection: defineService(({ onStart }) => {
        onStart(async () => {
          throw Error('refused');
        });
        return {};
      }),
    },
    setup: ({ scope }) => {
      handle = scope.slots.attach({ slot: 'header', component: 'widget' }, { availability: 'wait' });
    },
  });
  runtime.mount();
  await assert.rejects(runtime.ready, /refused/);
  await runtime.stop();
  await assert.rejects(handle.ready, (e) => e.code === 'detached');
  assert.equal(runtime.slots.get('header').items.length, 0);
  const x = isolated();
  x.lifecycle.plugin('owner', 'ready');
  x.lifecycle.update({ cleanup: 'pending' });
  assert.throws(
    () => x.slots.attach({ slot: 'surface', component: 'widget' }),
    (e) => e.code === 'unavailable-slot',
  );
  assert.equal(x.registry.reader.get('surface').phase, 'stopping');
  await x.scope.dispose();
});

test('custom application IDs and discovered sources survive startup error attribution', () => {
  const runtime = createRuntime({
    appId: 'host',
    slots: { header: defineSlot({ accepts: 'actions' }) },
    ui: { slots: [pluginSlot({ default: 'wrong' }, 'header', 'ui/slots/header.tsx')] },
  });
  assert.throws(
    () => runtime.mount(),
    (e) => e.plugin === 'host' && e.app === true && e.source === 'ui/slots/header.tsx',
  );
});

test('slot notifications use the existing reserved bus and watch subscribes before its initial callback', async () => {
  let scope;
  const runtime = createRuntime({
    slots: { header: component() },
    setup: ({ scope: app }) => {
      scope = app;
    },
  });
  const events = [];
  runtime.events.on('runtime.slot', (event) => events.push(event.data));
  assert.throws(() => runtime.events.emit('runtime.slot', {}), /only by the runtime/);
  runtime.mount();
  await runtime.ready;
  const states = [];
  let handle;
  const off = scope.slots.watch('header', (state) => {
    states.push(state);
    if (states.length === 1) handle = scope.slots.attach({ slot: 'header', component: 'live' });
  });
  await handle.ready;
  assert.deepEqual(
    states.map((s) => s.items.length),
    [0, 1],
  );
  assert.equal(events.at(-1), runtime.slots.get('header'));
  off();
  await runtime.stop();
});

test('reentrant owner stop never announces later attachments as ready from an obsolete snapshot', async () => {
  const x = isolated();
  const first = x.slots.attach({ slot: 'surface', component: 1 }, { availability: 'wait' });
  const second = x.slots.attach({ slot: 'surface', component: 2 }, { availability: 'wait' });
  const states = [];
  let resolved = false;
  first.watch((s) => {
    if (s.phase === 'attached') x.lifecycle.plugin('owner', 'stopped');
  });
  second.watch((s) => states.push(s.phase));
  second.ready.then(
    () => {
      resolved = true;
    },
    () => {},
  );
  x.lifecycle.plugin('owner', 'ready');
  await Promise.resolve();
  assert.deepEqual(states, ['pending']);
  assert.equal(resolved, false);
  assert.equal(x.registry.reader.get('surface').items.length, 0);
  await x.scope.dispose();
});
