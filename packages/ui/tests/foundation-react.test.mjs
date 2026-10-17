import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createElement as h,
  act,
  StrictMode,
  useEffect,
  useState,
  createContext,
  useContext,
} from 'react';
import { installDom, mount, click, deferred, silenced, testUI } from './support.mjs';
import { ActionProvider, ActionButton, useAction, useActionList } from '../dist/actions/index.js';
import { createActionList } from '@bitakit/core';
import { BitaKitRuntimeProvider, ActionBoundary, PluginSlot, PluginPage, useCurrentPage, useBitaKit, useBitaKitApp, useService, useServiceState, useEvent, useTranslation, useGroupTitle } from '../dist/index.js';
import { defineAction, definePlugin, defineService, defineEvents, event, createTranslationPlugin, ActionGroup } from '@bitakit/core';
import {
  StandardBitaKitRuntimeProvider,
  StandardActionMenu,
  standardBitaKitUI,
} from '../dist/components.js';

installDom();

test('one BitaKitRuntimeProvider owns the action list; the app facade follows plugin removal', async () => {
  let calls = 0;
  const documents = definePlugin({
    id: 'documents',
    services: { store: defineService(() => ({ title: 'Available' })) },
    actions: { create: defineAction({ title: 'Create', execute: () => ++calls }) },
  });
  let app;
  let actions;
  function Consumer() {
    app = useBitaKitApp();
    actions = useBitaKit().runtime.actions;
    return h(
      'div',
      null,
      h(
        'output',
        null,
        app.has('documents.store') ? app.services.documents.store.title : 'Unavailable',
      ),
      h(ActionButton, { action: app.actions.documents.create }),
    );
  }
  const tree = (plugins) => h(BitaKitRuntimeProvider, { ui: testUI, plugins }, h(Consumer));
  const view = await mount(tree([documents]));
  try {
    const list = actions;
    assert.equal(app.services.documents.store.title, 'Available');
    assert.equal(view.container.querySelector('output').textContent, 'Available');
    await click(view.container.querySelector('button'));
    assert.equal(calls, 1);
    await view.render(tree([]));
    assert.equal(actions, list, 'plugin changes retain the sole ActionList');
    assert.equal(view.container.textContent, 'Unavailable');
    assert.equal(
      view.container.querySelector('button'),
      null,
      'a reference to a removed action renders nothing',
    );
    assert.throws(() => app.services.documents, /No active plugin exposes/);
    assert.equal(app.has('documents.store'), false);
  } finally {
    await view.unmount();
  }
});

test('Strict Mode keeps service instances and an open dialog across translation changes; the boundary fails closed', async () => {
  const list = createActionList();
  let created = 0;
  let disposed = 0;
  const gate = deferred();
  function InviteDialog({ input, close }) {
    const [email, setEmail] = useState(input?.email ?? 'a@example.com');
    const submit = useAction('users.submit', { email });
    return h(
      'div',
      null,
      h('input', {
        value: email,
        disabled: !!submit?.pending,
        onChange: (event) => setEmail(event.target.value),
      }),
      h('button', { ...submit?.props({ onExecuted: () => close() }) }, 'Send'),
    );
  }
  const config = {
    plugins: [
      definePlugin({
        id: 'users',
        services: {
          resource: defineService(({ onStop }) => {
            created++;
            onStop(() => disposed++);
            return {};
          }),
        },
        actions: {
          invite: defineAction({ title: 'title', dialog: InviteDialog }),
          submit: defineAction({ internal: true, execute: () => gate.promise }),
        },
      }),
    ],
  };
  const tree = (locale) =>
    h(
      StrictMode,
      null,
      h(
        ActionProvider,
        { actions: list },
        h(
          BitaKitRuntimeProvider,
          { config, ui: testUI, translate: (key) => `${locale}:${key}` },
          h(ActionButton, { action: 'users.invite', input: { email: 'b@example.com' } }),
          h(ActionBoundary, { action: 'missing', fallback: 'Blocked' }, 'Never render'),
        ),
      ),
    );
  const view = await mount(tree('en'));
  const dialog = () => view.container.querySelector('[role=dialog]');
  try {
    const count = created;
    assert.ok(count >= 1);
    assert.match(view.container.textContent, /Blocked/);
    assert.doesNotMatch(view.container.textContent, /Never render/);
    assert.equal(view.container.querySelector('button').textContent, 'en:title');
    await click(view.container.querySelector('button'));
    assert.equal(dialog().querySelector('h2').textContent, 'en:title');
    assert.equal(
      dialog().querySelector('input').value,
      'b@example.com',
      'the dialog receives the execution input',
    );
    await click(dialog().querySelector('button'));
    assert.equal(
      dialog().querySelector('input').disabled,
      true,
      'pending reaches the dialog through useAction',
    );
    await view.render(tree('de'));
    assert.equal(created, count, 'a translation change keeps the runtime and its services');
    assert.equal(disposed, count - 1, 'Strict Mode replayed the mount exactly once');
    assert.ok(dialog(), 'the open dialog survives');
    assert.equal(dialog().querySelector('h2').textContent, 'de:title');
    assert.equal(dialog().querySelector('input').disabled, true);
    await act(async () => gate.resolve());
    assert.equal(dialog(), null, 'onExecuted closes the dialog');
  } finally {
    await view.unmount();
  }
  assert.equal(disposed, created);
  assert.equal(list.get('users.invite'), undefined);
});

test('ActionBoundary shows the unavailable label and follows enabled and visible without executing', async () => {
  const config = {
    actions: { access: defineAction({ title: 'Access', enabled: false, execute() {} }) },
  };
  let list;
  function Capture() {
    list = useActionList();
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI, labels: { unavailable: 'Not allowed' } },
      h(Capture),
      h(ActionBoundary, { action: 'access' }, 'Private content'),
      h(
        ActionBoundary,
        { action: 'access', fallback: (message) => h('em', null, `Fallback: ${message}`) },
        'Also private',
      ),
    ),
  );
  try {
    assert.equal(view.container.textContent, 'Not allowedFallback: Not allowed');
    assert.equal(view.container.querySelector('[role=status]').textContent, 'Not allowed');
    await act(async () => {
      list.update('access', { enabled: true });
    });
    assert.equal(view.container.textContent, 'Private contentAlso private');
    await act(async () => {
      list.update('access', { visible: false });
    });
    assert.equal(view.container.textContent, '');
  } finally {
    await view.unmount();
  }
});

test('plugin and app providers nest outside-in, survive translation changes and can be replaced', async () => {
  const Context = createContext('');
  let mounts = 0;
  function Outer({ children }) {
    useEffect(() => {
      mounts++;
    }, []);
    return h(Context.Provider, { value: 'outer' }, children);
  }
  function Inner({ children }) {
    return h('section', { 'data-context': useContext(Context) }, children);
  }
  const config = {
    ui: { providers: [{ id: 'inner', component: Inner, requires: ['outer'] }] },
    plugins: [
      definePlugin({ id: 'theme', ui: { providers: [{ id: 'outer', component: Outer }] } }),
    ],
  };
  const tree = (translate, providers) =>
    h(BitaKitRuntimeProvider, { config, ui: testUI, translate, providers }, h('span', null, 'Content'));
  const view = await mount(tree((key) => `en:${key}`));
  try {
    assert.equal(
      view.container.querySelector('section').dataset.context,
      'outer',
      'plugin providers wrap app providers',
    );
    assert.equal(view.container.querySelector('section').textContent, 'Content');
    await view.render(tree((key) => `de:${key}`));
    assert.equal(mounts, 1);
    await view.render(tree((key) => key, []));
    assert.equal(
      view.container.querySelector('section'),
      null,
      'an explicit list replaces every provider',
    );
    assert.match(view.container.textContent, /Content/);
  } finally {
    await view.unmount();
  }
});

test('plugin slots render after setup and disappear with the plugin', async () => {
  const pages = new Set();
  const demo = definePlugin({
    id: 'demo',
    services: { catalog: defineService(() => pages) },
    actions: { open: defineAction({ title: 'Open', groups: ['account'], execute() {} }) },
    setup({ services }) {
      services.demo.catalog.add('demo');
      return () => services.demo.catalog.delete('demo');
    },
    ui: {
      slots: [
        {
          slot: 'dashboard',
          component: () => {
            assert.equal(pages.has('demo'), true, 'slot content renders only after setup');
            return h('section', null, 'Plugin content');
          },
        },
      ],
    },
  });
  let list;
  function Capture() {
    list = useActionList();
    return null;
  }
  const tree = (plugins) =>
    h(
      BitaKitRuntimeProvider,
      { config: { plugins: [demo] }, plugins, ui: testUI },
      h(Capture),
      h('main', null, 'Dashboard', h(PluginSlot, { name: 'dashboard' })),
    );
  const view = await mount(tree(undefined));
  try {
    assert.match(view.container.textContent, /Plugin content/);
    assert.ok(list.get('demo.open'));
    await view.render(tree([]));
    assert.equal(view.container.textContent, 'Dashboard');
    assert.equal(pages.size, 0);
    assert.equal(list.get('demo.open'), undefined);
    await view.render(tree(undefined));
    assert.match(view.container.textContent, /Plugin content/);
    assert.equal(pages.size, 1);
  } finally {
    await view.unmount();
  }
  assert.equal(pages.size, 0);
});

test('PluginPage renders the page for the current path with its params; useCurrentPage describes it', async () => {
  let cleaned = 0;
  function Index() {
    return h('p', null, 'All tasks');
  }
  function Details({ params }) {
    useEffect(
      () => () => {
        cleaned++;
      },
      [],
    );
    return h('p', null, `Task ${params.id}`);
  }
  const tasks = definePlugin({
    id: 'tasks',
    ui: {
      pages: [
        { path: '/tasks', component: Index },
        { path: '/tasks/[id]', component: Details, layout: 'blank' },
      ],
    },
  });
  let current;
  function Current() {
    current = useCurrentPage();
    return null;
  }
  const tree = (plugins, pathname) =>
    h(
      BitaKitRuntimeProvider,
      { config: { plugins: [tasks] }, plugins, ui: testUI, actionOptions: { pathname } },
      h('header', null, 'Host'),
      h(PluginPage, { fallback: 'Missing' }),
      h(Current),
    );
  const view = await mount(tree(undefined, '/tasks/42'));
  try {
    assert.equal(view.container.textContent, 'HostTask 42', 'the router pathname selects the page');
    assert.deepEqual(
      {
        params: current.params,
        plugin: current.plugin,
        layout: current.layout,
        path: current.path,
      },
      { params: { id: '42' }, plugin: 'tasks', layout: 'blank', path: '/tasks/[id]' },
    );
    await view.render(tree(undefined, '/tasks'));
    assert.equal(view.container.textContent, 'HostAll tasks');
    assert.equal(cleaned, 1);
    assert.deepEqual(current.params, {});
    await view.render(tree(undefined, '/elsewhere'));
    assert.equal(view.container.textContent, 'HostMissing');
    assert.equal(current, undefined);
    await view.render(tree([], '/tasks/42'));
    assert.equal(
      view.container.textContent,
      'HostMissing',
      'the page leaves with its plugin while the host remains',
    );
    await view.render(
      h(
        BitaKitRuntimeProvider,
        { config: { plugins: [tasks] }, ui: testUI },
        h(PluginPage, { pathname: '/tasks/7' }),
      ),
    );
    assert.equal(
      view.container.textContent,
      'Task 7',
      'an explicit pathname works without a router',
    );
  } finally {
    await view.unmount();
  }
});

test('useServiceState follows a service store with shallow-equal selectors and falls back until the runtime is ready', async () => {
  const start = deferred();
  const items = defineService(({ store, onStart }) => {
    const state = store({ items: [], filter: 'all' });
    onStart(() => start.promise);
    return {
      state,
      add: (title) => state.set((current) => ({ ...current, items: [...current.items, title] })),
      setFilter: (filter) => state.set((current) => ({ ...current, filter })),
    };
  });
  const config = {
    plugins: [
      definePlugin({
        id: 'todos',
        services: { items, plain: defineService(() => ({ value: 1 })) },
      }),
    ],
  };
  const renders = { titles: 0 };
  let runtime;
  let service;
  function Titles() {
    renders.titles++;
    const titles = useServiceState('todos.items', (state) =>
      state.items.map((item) => item.toUpperCase()),
    );
    return h('output', { 'data-name': 'titles' }, titles ? `[${titles.join(',')}]` : 'loading');
  }
  function Count() {
    runtime = useBitaKit().runtime;
    service = useService('todos.items');
    const count = useServiceState('todos.items', (state) => state.items.length, 0);
    const whole = useServiceState('todos.items');
    return h('output', { 'data-name': 'count' }, `${count}:${whole?.filter ?? 'none'}`);
  }
  const view = await mount(h(BitaKitRuntimeProvider, { config, ui: testUI }, h(Titles), h(Count)));
  const text = (name) => view.container.querySelector(`[data-name="${name}"]`).textContent;
  try {
    assert.equal(runtime.isReady(), false, 'onStart is still pending');
    assert.equal(
      text('titles'),
      'loading',
      'without a fallback the state is undefined until ready',
    );
    assert.equal(text('count'), '0:none', 'the fallback stands in until ready');
    assert.equal(service, undefined, 'useService is undefined until ready');
    await act(async () => start.resolve());
    assert.equal(runtime.isReady(), true);
    assert.equal(text('titles'), '[]');
    assert.equal(text('count'), '0:all');
    assert.equal(service, runtime.services.todos.items, 'useService returns the live instance');
    await act(async () => runtime.services.todos.items.add('milk'));
    assert.equal(text('titles'), '[MILK]');
    assert.equal(text('count'), '1:all');
    const before = renders.titles;
    await act(async () => runtime.services.todos.items.setFilter('done'));
    assert.equal(text('count'), '1:done');
    assert.equal(renders.titles, before, 'an array selector with equal entries does not re-render');
  } finally {
    await view.unmount();
  }
  function Plain() {
    useServiceState('todos.plain');
    return null;
  }
  await silenced(() =>
    assert.rejects(
      mount(h(BitaKitRuntimeProvider, { config, ui: testUI }, h(Plain))),
      /useServiceState\("todos.plain"\): the service has no observable state/,
    ),
  );
});

test('useServiceState also follows subscribe/getSnapshot services, such as host-provided authentication', async () => {
  let snapshot = { user: null };
  const listeners = new Set();
  const session = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  function User() {
    const name = useServiceState('session', (state) => state.user?.name ?? 'anonymous', 'loading');
    return h('output', null, name);
  }
  const view = await mount(
    h(BitaKitRuntimeProvider, { config: {}, ui: testUI, services: { session } }, h(User)),
  );
  try {
    assert.equal(view.container.textContent, 'anonymous');
    await act(async () => {
      snapshot = { user: { name: 'Ada' } };
      listeners.forEach((listener) => listener());
    });
    assert.equal(view.container.textContent, 'Ada');
  } finally {
    await view.unmount();
  }
  assert.equal(listeners.size, 0, 'subscriptions are released with the component');
});

test('useServiceState preserves class receivers during subscription, updates and cleanup', async () => {
  class Counter {
    listeners = new Set();
    value = 0;
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    getSnapshot() { return this.value; }
    increment() {
      this.value++;
      this.listeners.forEach((listener) => listener());
    }
  }
  const counter = new Counter();
  function Consumer() {
    return h('output', null, useServiceState('counter', undefined, -1));
  }
  const view = await mount(h(BitaKitRuntimeProvider, { config: {}, ui: testUI, services: { counter } }, h(Consumer)));
  try {
    assert.equal(view.container.textContent, '0');
    await act(async () => counter.increment());
    assert.equal(view.container.textContent, '1');
  } finally {
    await view.unmount();
  }
  assert.equal(counter.listeners.size, 0);
});

test('useEvent subscribes to the runtime bus once per name set and releases with the component', async () => {
  const received = [];
  const config = {
    plugins: [definePlugin({ id: 'todos', events: defineEvents({ changed: event() }) })],
  };
  let runtime;
  function Consumer({ label, names }) {
    runtime = useBitaKit().runtime;
    useEvent(names, (event) => received.push([label, event.type, event.data]));
    return null;
  }
  const tree = (label, names) =>
    h(
      StrictMode,
      null,
      h(BitaKitRuntimeProvider, { config, ui: testUI }, h(Consumer, { label, names })),
    );
  const view = await mount(tree('first', ['todos.changed']));
  try {
    assert.equal(runtime.events.subscriptionCount, 1, 'Strict Mode replay leaves one subscription');
    await act(async () => runtime.events.emit('todos.changed', { count: 1 }));
    assert.deepEqual(received, [['first', 'todos.changed', { count: 1 }]]);
    await view.render(tree('second', ['todos.changed']));
    assert.equal(
      runtime.events.subscriptionCount,
      1,
      'a new inline array with the same names does not resubscribe',
    );
    await act(async () => runtime.events.emit('todos.changed', { count: 2 }));
    assert.deepEqual(
      received.at(-1),
      ['second', 'todos.changed', { count: 2 }],
      'the latest handler runs',
    );
    await view.render(tree('wild', 'todos.*'));
    assert.equal(runtime.events.subscriptionCount, 1);
    await act(async () => runtime.events.emit('todos.changed', { count: 3 }));
    assert.deepEqual(received.at(-1), ['wild', 'todos.changed', { count: 3 }]);
  } finally {
    await view.unmount();
  }
  assert.equal(runtime.events.subscriptionCount, 0);
  const count = received.length;
  runtime.events.emit('todos.changed', { count: 4 });
  assert.equal(received.length, count);
});

test('DialogHost renders the action dialog with input, close and services inside the host primitives', async () => {
  function Rename({ input, close, services }) {
    return h(
      'div',
      null,
      h('p', null, `Rename ${input.id} of ${services.demo.items.count()}`),
      h('button', { 'data-close': true, onClick: () => close() }, 'Done'),
    );
  }
  const config = {
    plugins: [
      definePlugin({
        id: 'demo',
        services: { items: defineService(() => ({ count: () => 2 })) },
        actions: {
          rename: defineAction({
            title: 'Rename',
            description: 'Pick a new name',
            dialog: Rename,
            dialogSize: 'wide',
          }),
        },
      }),
    ],
  };
  let runtime;
  function Capture() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI },
      h(Capture),
      h(ActionButton, { action: 'demo.rename', input: { id: 3 } }),
    ),
  );
  const dialog = () => view.container.querySelector('[role=dialog]');
  try {
    assert.equal(dialog(), null);
    await click(view.container.querySelector('button'));
    assert.equal(dialog().querySelector('h2').textContent, 'Rename');
    assert.equal(
      dialog().querySelector('p[id="demo.rename-description"]').textContent,
      'Pick a new name',
    );
    assert.equal(
      dialog().querySelector('[data-size="wide"]').getAttribute('aria-describedby'),
      'demo.rename-description',
    );
    assert.match(dialog().textContent, /Rename 3 of 2/, 'the dialog receives input and services');
    assert.deepEqual(runtime.getSnapshot().input, { id: 3 });
    await click(dialog().querySelector('[data-close]'));
    assert.equal(dialog(), null);
    assert.equal(runtime.getSnapshot(), null);
  } finally {
    await view.unmount();
  }
});

test('actions with confirm ask through ConfirmDialog: confirming executes, cancelling skips with reason cancelled', async () => {
  const config = {
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          clear: defineAction({
            title: 'Clear',
            confirm: {
              title: 'Clear everything?',
              description: 'This cannot be undone.',
              destructive: true,
            },
            execute: () => 'cleared',
          }),
          archive: defineAction({
            title: 'Archive',
            confirm: ({ input }) => (input.locked ? 'Archive a locked item?' : false),
            execute: ({ input }) => `archived:${input.id}`,
          }),
        },
      }),
    ],
  };
  let list;
  function Capture() {
    list = useActionList();
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config,
        ui: testUI,
        labels: { confirm: 'Yes, clear' },
        translate: (key) => (key === 'Foundation.cancel' ? 'Keep' : key),
      },
      h(Capture),
      h('main', null, h(ActionButton, { action: 'todos.clear' })),
    ),
  );
  const dialog = () => view.container.querySelector('[role=dialog]');
  const buttons = () => [...dialog().querySelectorAll('button')];
  try {
    let run;
    await act(async () => {
      run = list.execute('todos.clear');
    });
    assert.equal(dialog().querySelector('h2').textContent, 'Clear everything?');
    assert.match(dialog().textContent, /This cannot be undone\./);
    assert.deepEqual(
      buttons().map((button) => [button.textContent, button.dataset.variant]),
      [
        ['Keep', 'outline'],
        ['Yes, clear', 'destructive'],
      ],
      'labels come from the catalog first, then the labels prop',
    );
    assert.equal(
      list.get('todos.clear').pending,
      true,
      'the action is pending while the question is open',
    );
    assert.equal(view.container.querySelector('main button').disabled, true);
    await click(buttons()[1]);
    assert.deepEqual(await run, { status: 'completed', value: 'cleared' });
    assert.equal(dialog(), null);
    await act(async () => {
      run = list.execute('todos.clear');
    });
    await click(buttons()[0]);
    assert.deepEqual(await run, { status: 'skipped', reason: 'cancelled' });
    assert.equal(list.get('todos.clear').pending, false);
    assert.equal(dialog(), null);
    await act(async () => {
      assert.equal(
        (await list.execute('todos.archive', { id: 1, locked: false })).value,
        'archived:1',
        'a falsy confirm does not ask',
      );
    });
    await act(async () => {
      run = list.execute('todos.archive', { id: 2, locked: true });
    });
    assert.equal(dialog().querySelector('h2').textContent, 'Archive a locked item?');
    assert.equal(dialog().querySelector('p'), null, 'a plain string has no description');
    await click(buttons()[1]);
    assert.deepEqual(await run, { status: 'completed', value: 'archived:2' });
  } finally {
    await view.unmount();
  }
});

test('notify receives the default failure toast and explicit success feedback', async () => {
  const toasts = [];
  const errors = [];
  const config = {
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          save: defineAction({
            title: 'Save',
            execute: ({ input }) => {
              if (input === 'fail') throw new Error('Disk full');
              return 1;
            },
            success: 'Saved',
          }),
        },
      }),
    ],
  };
  let list;
  function Capture() {
    list = useActionList();
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config,
        ui: testUI,
        notify: (message, kind) => toasts.push([kind, message]),
        actionOptions: { onError: (error) => errors.push(error.message) },
      },
      h(Capture),
      h(ActionButton, { action: 'todos.save', input: 'fail' }),
    ),
  );
  try {
    await act(async () => {
      assert.deepEqual(await list.execute('todos.save'), { status: 'completed', value: 1 });
    });
    assert.deepEqual(toasts, [['success', 'Saved']]);
    await click(view.container.querySelector('button'));
    assert.deepEqual(
      toasts.at(-1),
      ['failure', 'Disk full'],
      'a failure without feedback shows the error once',
    );
    assert.deepEqual(
      errors,
      ['Disk full'],
      'the button routes the rejection to the provider error handler',
    );
    assert.equal(list.get('todos.save').status, 'failed');
    assert.equal(toasts.length, 2);
  } finally {
    await view.unmount();
  }
});

test('additionalPlugins replace configured plugins by ID in place and append the rest', async () => {
  const first = definePlugin({
    id: 'first',
    services: { store: defineService(() => ({ kind: 'original' })) },
  });
  const last = definePlugin({ id: 'last' });
  const replacement = definePlugin({
    id: 'first',
    metadata: { name: 'Replacement' },
    services: { store: defineService(() => ({ kind: 'replacement' })) },
  });
  const appended = definePlugin({ id: 'appended' });
  const config = { plugins: [first, last] };
  let runtime;
  function Read() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config,
        ui: testUI,
        additionalPlugins: [replacement, appended],
        actionOptions: { shortcuts: false },
      },
      h(Read),
    ),
  );
  try {
    assert.deepEqual(
      runtime.config.plugins.map((plugin) => plugin.id),
      ['first', 'last', 'appended'],
    );
    assert.equal(runtime.config.plugins[0], replacement);
    assert.equal(
      runtime.modules.find((module) => module.id === 'first').metadata.name,
      'Replacement',
    );
    assert.equal(runtime.services.first.store.kind, 'replacement');
    assert.deepEqual(config.plugins, [first, last], 'the configuration is not mutated');
  } finally {
    await view.unmount();
  }
});

test('BitaKitRuntimeProvider defaults to the standard visuals and labels; partial labels merge; aliases point at the same exports', async () => {
  let seen;
  function Read() {
    seen = useBitaKit();
    return null;
  }
  const view = await mount(h(BitaKitRuntimeProvider, { config: {} }, h(Read)));
  try {
    assert.equal(seen.ui, standardBitaKitUI);
    assert.equal(seen.ui.Menu, StandardActionMenu);
    assert.deepEqual(seen.labels, {
      cancel: 'Cancel',
      confirm: 'Confirm',
      submit: 'Save',
      pending: 'Saving …',
      invalid: 'Please check your input.',
      unavailable: 'Unavailable',
    });
    await view.render(h(BitaKitRuntimeProvider, { config: {}, labels: { confirm: 'Yes' } }, h(Read)));
    assert.equal(seen.labels.confirm, 'Yes');
    assert.equal(seen.labels.cancel, 'Cancel');
    assert.equal(StandardBitaKitRuntimeProvider, BitaKitRuntimeProvider);
  } finally {
    await view.unmount();
  }
});

test('translation hook reacts to translation service updates, interpolates and preserves fallbacks', async () => {
  const makeTranslator = (word) => {
    const t = (key, values) => (key === 'greeting' ? `${word} ${values.name}` : key);
    t.has = (key) => key === 'greeting';
    return t;
  };
  const plugin = createTranslationPlugin(makeTranslator('Hallo'));
  function Consumer() {
    const t = useTranslation();
    return h(
      'output',
      null,
      t('greeting', { name: 'Ada' }),
      ' / ',
      t('missing', undefined, 'Fallback'),
    );
  }
  const view = await mount(h(BitaKitRuntimeProvider, { plugins: [plugin], ui: testUI }, h(Consumer)));
  try {
    assert.equal(view.container.textContent, 'Hallo Ada / Fallback');
    await act(async () => plugin.update(makeTranslator('Hello')));
    assert.equal(view.container.textContent, 'Hello Ada / Fallback');
  } finally {
    await view.unmount();
  }
  plugin.update(makeTranslator('Later'));
});

test('group headings use the title the app gave a group ID, even from an untitled snapshot group', async () => {
  // The plain name registers first, so this action's snapshot holds an untitled group object.
  const plugins = [
    definePlugin({
      id: 'todos',
      actions: {
        clear: defineAction({ title: 'Clear', groups: ['todos.bulk'], execute() {} }),
        export: defineAction({
          title: 'Export',
          groups: [new ActionGroup('todos.bulk', 'Bulk actions')],
          execute() {},
        }),
        open: defineAction({ title: 'Open', groups: ['navigation'], execute() {} }),
      },
    }),
  ];
  const headings = [];
  function Headings() {
    const groupTitle = useGroupTitle();
    const list = useActionList();
    const clear = list.get('todos.clear');
    const open = list.get('todos.open');
    if (clear && open)
      headings.push(
        groupTitle(clear.groups[0]),
        groupTitle(open.groups[0]),
        groupTitle({ id: 'other' }),
      );
    return null;
  }
  const view = await mount(h(BitaKitRuntimeProvider, { plugins, ui: testUI }, h(Headings)));
  try {
    assert.deepEqual(headings.slice(-3), ['Bulk actions', 'General', 'other']);
  } finally {
    await view.unmount();
  }
});

test('an input schema disables controls while their input is invalid; app.actions references bind buttons', async () => {
  const received = [];
  const title = {
    parse: (value) => {
      if (typeof value !== 'string' || !value.trim()) throw new Error('Title required');
      return value.trim();
    },
  };
  const config = {
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          add: defineAction({
            title: 'Add',
            input: title,
            execute: ({ input }) => received.push(input),
          }),
        },
      }),
    ],
  };
  let list;
  function Buttons({ first, second }) {
    const app = useBitaKitApp();
    list = useActionList();
    return h(
      'div',
      null,
      h(ActionButton, { action: app.actions.todos.add, input: first }),
      h(ActionButton, { action: 'todos.add', input: second }),
    );
  }
  const tree = (first, second) =>
    h(BitaKitRuntimeProvider, { config, ui: testUI }, h(Buttons, { first, second }));
  const view = await mount(tree('', ' Second '));
  const buttons = () => [...view.container.querySelectorAll('button')];
  try {
    assert.deepEqual(
      buttons().map((button) => button.disabled),
      [true, false],
    );
    await view.render(tree(' First ', '   '));
    assert.deepEqual(
      buttons().map((button) => button.disabled),
      [false, true],
    );
    await click(buttons()[0]);
    assert.deepEqual(received, ['First'], 'execute receives the parsed input');
    assert.deepEqual(await list.execute('todos.add', '  '), {
      status: 'skipped',
      reason: 'disabled',
    });
  } finally {
    await view.unmount();
  }
});
