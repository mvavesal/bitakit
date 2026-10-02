import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, defineAction, definePlugin, defineService } from '../dist/core.js';

const counter = defineService(({ store }) => {
  const state = store({ count: 0 });
  return {
    state,
    increment: () => state.set((current) => ({ count: current.count + 1 })),
    reset: () => state.set({ count: 0 }),
  };
});

test('function-valued enabled follows store changes in snapshots and in bound reads', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        services: { counter },
        actions: {
          bump: defineAction({ execute: ({ services }) => services.demo.counter.increment() }),
          reset: defineAction({
            enabled: ({ services }) => services.demo.counter.state.get().count > 0,
            execute: ({ services }) => services.demo.counter.reset(),
          }),
          remove: defineAction({
            enabled: ({ input, services }) =>
              typeof input === 'number' && input <= services.demo.counter.state.get().count,
            execute: () => 'removed',
          }),
        },
      }),
    ],
  });
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    let publishes = 0;
    const off = actions.subscribe(() => publishes++);
    assert.equal(actions.get('demo.reset').enabled, false);
    assert.equal(actions.resolve('demo.reset').enabled, false);
    assert.deepEqual(await actions.execute('demo.reset'), {
      status: 'skipped',
      reason: 'disabled',
    });
    await actions.execute('demo.bump');
    assert.equal(actions.get('demo.reset').enabled, true);
    assert.equal(actions.resolve('demo.reset').enabled, true);
    assert.ok(publishes > 0, 'store changes publish a new snapshot');
    // The unbound snapshot evaluates without input; bound reads refine it per input.
    assert.equal(actions.get('demo.remove').enabled, false);
    assert.equal(actions.resolve('demo.remove', 1).enabled, true);
    assert.equal(actions.resolve('demo.remove', 2).enabled, false);
    assert.deepEqual(await actions.execute('demo.remove', 2), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.equal((await actions.execute('demo.remove', 1)).value, 'removed');
    await actions.execute('demo.reset');
    assert.equal(actions.get('demo.reset').enabled, false);
    assert.equal(actions.resolve('demo.reset').enabled, false);
    off();
  } finally {
    stop();
  }
});

test('every presentation field except icon accepts a function of { input, services, config, app }', () => {
  const Icon = Symbol('icon');
  const runtime = createRuntime({
    configOverrides: { demo: { label: 'Counter' } },
    plugins: [
      definePlugin({
        id: 'demo',
        config: { label: 'Count' },
        services: { counter },
        actions: {
          show: defineAction({
            title: ({ services, config }) =>
              `${config.plugin.get('label')}: ${services.demo.counter.state.get().count}`,
            description: ({ input }) => (input ? `Input ${input}` : undefined),
            tooltip: ({ app }) => `tip:${app.config.demo.label}`,
            // icon stays static: a component value cannot be told apart from a presentation function.
            icon: Icon,
            variant: ({ services }) =>
              services.demo.counter.state.get().count > 1 ? 'destructive' : 'default',
            href: ({ input }) => `/demo/${input ?? 'all'}`,
            visible: ({ services }) => services.demo.counter.state.get().count < 3,
            checked: ({ services }) => services.demo.counter.state.get().count % 2 === 1,
            value: ({ services }) => services.demo.counter.state.get().count,
          }),
        },
      }),
    ],
  });
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    const initial = actions.get('demo.show');
    assert.equal(initial.title, 'Counter: 0');
    assert.equal(initial.description, undefined);
    assert.equal(initial.tooltip, 'tip:Counter');
    assert.equal(initial.icon, Icon);
    assert.equal(initial.variant, 'default');
    assert.equal(initial.href, '/demo/all');
    assert.equal(initial.visible, true);
    assert.equal(initial.checked, false);
    assert.equal(initial.value, 0);
    assert.equal(actions.resolve('demo.show', 7).description, 'Input 7');
    assert.equal(actions.resolve('demo.show', 7).href, '/demo/7');
    runtime.services.demo.counter.increment();
    const after = actions.get('demo.show');
    assert.equal(after.title, 'Counter: 1');
    assert.equal(after.icon, Icon);
    assert.equal(after.checked, true);
    assert.equal(after.value, 1);
    runtime.services.demo.counter.increment();
    runtime.services.demo.counter.increment();
    assert.equal(actions.get('demo.show').visible, false);
    assert.equal(actions.get('demo.show').variant, 'destructive');
    assert.deepEqual(actions.resolve('demo.show', 1), actions.resolve('demo.show', 1));
  } finally {
    stop();
  }
});

test('observable services (anything with subscribe) refresh presentation like stores, including host services', () => {
  let user = null;
  const listeners = new Set();
  const auth = {
    getSnapshot: () => ({ user, pending: false, error: undefined }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signOut: async () => {},
  };
  const feedListeners = new Set();
  let unread = 0;
  const feed = defineService(() => ({
    unread: () => unread,
    subscribe(listener) {
      feedListeners.add(listener);
      return () => feedListeners.delete(listener);
    },
  }));
  const runtime = createRuntime(
    {
      actions: {
        profile: defineAction({
          visible: ({ services }) => !!services.auth.getSnapshot().user,
          execute() {},
        }),
        inbox: defineAction({
          enabled: ({ services }) => services.news.feed.unread() > 0,
          execute() {},
        }),
      },
      plugins: [definePlugin({ id: 'news', services: { feed } })],
    },
    { services: { auth } },
  );
  const stop = runtime.mount();
  try {
    assert.equal(listeners.size, 1, 'one subscription per observable service');
    assert.equal(feedListeners.size, 1);
    assert.equal(runtime.actions.get('profile').visible, false);
    assert.equal(runtime.actions.get('inbox').enabled, false);
    user = { id: 'user' };
    listeners.forEach((listener) => listener());
    assert.equal(runtime.actions.get('profile').visible, true);
    unread = 2;
    feedListeners.forEach((listener) => listener());
    assert.equal(runtime.actions.get('inbox').enabled, true);
  } finally {
    stop();
  }
  assert.equal(listeners.size, 0, 'host subscriptions are released on stop');
  assert.equal(feedListeners.size, 0);
});

test('configured action overrides cap dynamic presentation: false wins over any reactive result', () => {
  const runtime = createRuntime({
    actionOverrides: { 'demo.reset': { enabled: false }, 'demo.show': { visible: false } },
    plugins: [
      definePlugin({
        id: 'demo',
        services: { counter },
        actions: {
          reset: defineAction({
            enabled: ({ services }) => services.demo.counter.state.get().count > 0,
            execute() {},
          }),
          show: defineAction({ visible: () => true, execute() {} }),
        },
      }),
    ],
  });
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    runtime.services.demo.counter.increment();
    assert.equal(actions.get('demo.reset').enabled, false);
    assert.equal(actions.resolve('demo.reset').enabled, false);
    assert.equal(actions.get('demo.show').visible, false);
  } finally {
    stop();
  }
});

test('a throwing presentation function fails closed for the unbound snapshot and surfaces in bound reads', () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'demo',
        actions: {
          trim: defineAction({
            enabled: ({ input }) => input.trim().length > 0,
            execute: () => 'ok',
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(
      runtime.actions.get('demo.trim').enabled,
      true,
      'no input: the unbound snapshot keeps the static default',
    );
    assert.equal(runtime.actions.resolve('demo.trim', 'x').enabled, true);
    assert.equal(runtime.actions.resolve('demo.trim', '  ').enabled, false);
    assert.throws(() => runtime.actions.resolve('demo.trim', 1), TypeError);
  } finally {
    stop();
  }
});
