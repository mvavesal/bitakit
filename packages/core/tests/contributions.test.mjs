import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionGroup,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  isActionSpec,
} from '../dist/core.js';

test('execute receives one context: input, services, config, app, events, signal, id, get and update', async () => {
  let seen;
  const runtime = createRuntime({
    configOverrides: { demo: { actions: { inspect: { label: 'Inspector' } } } },
    plugins: [
      definePlugin({
        id: 'demo',
        config: { actions: { inspect: { label: 'default', limit: 2 } } },
        services: { counter: defineService(() => ({ value: 1 })) },
        actions: {
          inspect: defineAction({
            execute: (context) => {
              seen = context;
              context.update({ checked: true });
              return [
                context.input,
                context.services.demo.counter.value,
                context.config.action.get('label'),
                context.config.action.get('limit'),
                context.config.plugin.get('actions.inspect.limit'),
                context.app.has('demo.counter'),
                typeof context.events.emit,
                context.signal instanceof AbortSignal,
                context.id,
                context.get()?.id,
              ];
            },
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual((await runtime.actions.execute('demo.inspect', 'in')).value, [
      'in',
      1,
      'Inspector',
      2,
      2,
      true,
      'function',
      true,
      'demo.inspect',
      'demo.inspect',
    ]);
    assert.equal(runtime.actions.get('demo.inspect').checked, true);
    assert.deepEqual(Object.keys(seen).sort(), [
      'app',
      'config',
      'environment',
      'events',
      'get',
      'id',
      'input',
      'services',
      'settings',
      'signal',
      'update',
    ]);
  } finally {
    stop();
  }
});

test('completed executions return the handler value, sync or async; the value is never stored on the action', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          count: defineAction({ execute: () => 42 }),
          create: defineAction({ execute: async ({ input }) => ({ id: `created:${input}` }) }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(await runtime.actions.execute('demo.count'), {
      status: 'completed',
      value: 42,
    });
    assert.deepEqual(await runtime.actions.execute('demo.create', 'a'), {
      status: 'completed',
      value: { id: 'created:a' },
    });
    assert.equal(runtime.actions.get('demo.create').value, undefined);
    assert.equal(Object.hasOwn(runtime.actions.get('demo.create'), 'input'), false);
  } finally {
    stop();
  }
});

test('dialog actions open the host dialog with the input instead of running; one dialog at a time', async () => {
  const Rename = () => null;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: { rename: defineAction({ title: 'Rename', dialog: Rename, dialogSize: 'wide' }) },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.getSnapshot(), null);
    assert.deepEqual(await runtime.actions.execute('demo.rename', { id: 3 }), {
      status: 'completed',
      value: undefined,
    });
    const state = runtime.getSnapshot();
    assert.equal(state.definition.dialog, Rename);
    assert.equal(state.definition.dialogSize, 'wide');
    assert.deepEqual(state.input, { id: 3 });
    assert.equal(typeof state.token, 'symbol');
    await runtime.actions.execute('demo.rename', { id: 4 });
    assert.equal(runtime.getSnapshot(), state, 'an open dialog is not replaced');
    runtime.close();
    assert.equal(runtime.getSnapshot(), null);
  } finally {
    stop();
  }
  assert.throws(
    () => defineAction({ dialog: Rename, execute() {} }),
    /opens a dialog or runs execute, not both/,
  );
  assert.throws(() => defineAction(), /expects an object/);
  assert.equal(isActionSpec(defineAction({ execute() {} })), true);
  assert.equal(isActionSpec({ execute() {} }), false);
});

test('internal actions execute by ID but stay out of enumeration; placement fields and metadata pass through', async () => {
  const bulk = new ActionGroup('demo.bulk', 'Bulk');
  const runtime = createRuntime({
    groups: ['demo.menu'],
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          visible: defineAction({
            title: 'Visible',
            groups: ['demo.menu', bulk],
            order: 2,
            dividerBefore: true,
            shortcut: { keys: 'Mod+S' },
            metadata: { origin: 'test' },
            execute: () => 'v',
          }),
          hidden: defineAction({ internal: true, execute: () => 'h' }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    const action = runtime.actions.get('demo.visible');
    assert.deepEqual(
      action.groups.map((group) => group.id),
      ['demo.menu', 'demo.bulk'],
    );
    assert.equal(action.groups[1], bulk);
    assert.equal(action.order, 2);
    assert.equal(action.dividerBefore, true);
    assert.deepEqual(action.shortcut, { keys: 'Mod+S' });
    assert.deepEqual(action.metadata, { origin: 'test' });
    assert.equal(runtime.getGroup('demo.bulk').title, 'Bulk');
    assert.deepEqual(Object.keys(runtime.app.actions.demo), ['visible']);
    assert.equal((await runtime.actions.execute('demo.hidden')).value, 'h');
    assert.throws(() => runtime.app.actions.demo.hidden.execute(), /Internal Action/);
  } finally {
    stop();
  }
});

test('a dialog action with a dynamic enabled can still be gated, and its dialog receives the resolved input', async () => {
  const Dialog = () => null;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          edit: defineAction({ dialog: Dialog, enabled: ({ input }) => input !== undefined }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(await runtime.actions.execute('demo.edit'), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.equal(runtime.getSnapshot(), null);
    await runtime.actions.execute('demo.edit', 'item');
    assert.equal(runtime.getSnapshot().input, 'item');
  } finally {
    stop();
  }
});
