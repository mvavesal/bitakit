import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionProvider, ActionButton, createActionList } from '@bitakit/ui/actions';
import { FoundationProvider, ActionBoundary, defineFormAction } from '../dist/index.js';
const dom = new JSDOM('<html><body></body></html>', {
  url: 'http://localhost',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const box = ({ children }) => h('div', null, children);
const ui = {
  Dialog: box,
  DialogContent: box,
  DialogHeader: box,
  DialogTitle: box,
  DialogDescription: box,
  DialogFooter: box,
  Button: ({ children, variant, ...props }) => h('button', props, children),
  Input: (props) => h('input', props),
  Field: box,
  FieldLabel: ({ children, ...props }) => h('label', props, children),
  FieldGroup: box,
  FieldError: box,
  Menu: box,
};
const labels = {
  cancel: 'Cancel',
  submit: 'Submit',
  pending: 'Pending',
  invalid: 'Invalid',
  unavailable: 'Unavailable',
};
test('a single FoundationProvider owns actions and updates optional public service access on removal', async () => {
  const { useFoundationApp, useFoundation, serviceKey, provideService, defineAction } = await import('../dist/index.js');
  const key = serviceKey('documents');
  const instance = { title: 'Available' };
  let calls = 0;
  const plugin = {
    id: 'documents',
    publicServices: { documents: key },
    services: [provideService(key, { create: () => instance })],
    actions: [defineAction({ id: 'documents.create', title: 'Create', execute: () => ++calls })],
  };
  let current;
  let currentList;
  function Consumer() {
    current = useFoundationApp();
    currentList = useFoundation().runtime.actions;
    return h('div', null,
      h('output', null, current.optional.services.documents?.title ?? 'Unavailable'),
      h(ActionButton, { action: current.actions.documents.create }),
    );
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  const tree = (plugins) => h(FoundationProvider, { ui, labels, plugins }, h(Consumer));
  try {
    await act(async () => root.render(tree([plugin])));
    const actions = currentList;
    assert.equal(current.services.documents, instance);
    assert.equal(host.querySelector('output').textContent, 'Available');
    await act(async () => host.querySelector('button').click());
    assert.equal(calls, 1);
    await act(async () => root.render(tree([])));
    assert.equal(currentList, actions, 'plugin changes retain the sole ActionList');
    assert.equal(host.textContent, 'Unavailable');
    assert.throws(() => current.services.documents, /No active plugin exposes/);
  } finally {
    await act(async () => root.unmount());
  }
});
test('StrictMode provider keeps instances and the pending dialog across locale changes; boundary fails closed', async () => {
  const list = createActionList();
  let created = 0,
    disposed = 0,
    finish;
  const form = defineFormAction({
    id: 'invite',
    title: 'title',
    fields: {
      email: {
        type: 'email',
        label: 'email',
        defaultValue: 'a@example.com',
      },
    },
    async submit() {
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
    success: { messageKey: 'success' },
    failure: { messageKey: 'error' },
  });
  const config = {
    groups: [],
    plugins: [
      {
        id: 'users',
        actions: [form],
        services: [
          {
            id: 'resource',
            create() {
              created++;
              return {};
            },
            dispose() {
              disposed++;
            },
          },
        ],
      },
    ],
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const tree = (locale) =>
    h(
      StrictMode,
      null,
      h(
        ActionProvider,
        { actions: list },
        h(
          FoundationProvider,
          { config, ui, translate: (key) => `${locale}:${key}`, labels },
          h(ActionButton, { action: 'invite' }),
          h(ActionBoundary, { action: 'missing', fallback: 'Blocked' }, 'Never render'),
        ),
      ),
    );
  let run;
  try {
    await act(async () => root.render(tree('en')));
    const count = created;
    assert.match(container.textContent, /Blocked/);
    assert.doesNotMatch(container.textContent, /Never render/);
    await act(async () => {
      await list.execute('invite');
    });
    await act(async () => {
      run = list.execute('invite.submit', { email: 'a@example.com' });
    });
    await act(async () => root.render(tree('de')));
    assert.equal(created, count);
    assert.equal(disposed, count - 1);
    assert.equal(container.querySelector('input').value, 'a@example.com');
    assert.equal(container.querySelector('input').disabled, true);
    assert.match(container.textContent, /de:title/);
    await act(async () => {
      finish();
      await run;
    });
  } finally {
    await act(async () => {
      finish?.();
      await run;
      root.unmount();
    });
    container.remove();
  }
  assert.equal(disposed, created);
  assert.equal(list.get('invite'), undefined);
});

test('boundary reads the shared action message and reacts without executing it', async () => {
  const { defineAction } = await import('../dist/index.js');
  const list = createActionList();
  list.register(
    defineAction({
      id: 'access',
      title: 'Access',
      enabled: false,
      unavailable: { messageKey: 'access.denied' },
    }),
  );
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        h(
          ActionProvider,
          { actions: list },
          h(ActionBoundary, { action: 'access' }, 'Private content'),
        ),
      ),
    );
    assert.equal(container.textContent, 'access.denied');
    await act(async () => list.update('access', { enabled: true }));
    assert.equal(container.textContent, 'Private content');
    await act(async () => list.update('access', { visible: false }));
    assert.equal(container.textContent, '');
  } finally {
    await act(async () => root.unmount());
  }
});

test('explicit provider lists replace discovery and nest outside-in without remounting on translation changes', async () => {
  const { defineProvider } = await import('@bitakit/core');
  const { createContext, useContext } = await import('react');
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
  const outer = defineProvider({ id: 'outer', component: Outer });
  const inner = defineProvider({ id: 'inner', component: Inner, requires: ['outer'] });
  const config = { providers: [outer, inner], actions: [], plugins: [] };
  const list = createActionList();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const tree = (translate, providers) =>
    h(
      ActionProvider,
      { actions: list },
      h(
        FoundationProvider,
        { config, ui, labels, translate, providers },
        h('span', null, 'Content'),
      ),
    );
  try {
    await act(async () => root.render(tree((key) => `en:${key}`)));
    assert.equal(container.querySelector('section').dataset.context, 'outer');
    await act(async () => root.render(tree((key) => `de:${key}`)));
    assert.equal(mounts, 1);
    await act(async () => root.render(tree((key) => key, [])));
    assert.equal(container.querySelector('section'), null);
    assert.match(container.textContent, /Content/);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('plugin views wait for setup and disappear with settings and actions on removal', async () => {
  const { PluginSlot, defineAction } = await import('../dist/index.js');
  const list = createActionList();
  const pages = new Set();
  const config = {
    plugins: [
      {
        id: 'demo',
        services: [{ id: 'catalog', create: () => pages }],
        actions: [defineAction({ id: 'demo.open', groups: ['account'] })],
        setup({ services }) {
          services.catalog.add('demo');
          return () => services.catalog.delete('demo');
        },
        views: [
          {
            slot: 'dashboard',
            component: () => {
              assert.equal(pages.has('demo'), true);
              return h('section', null, 'Plugin content');
            },
          },
        ],
      },
    ],
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const tree = (plugins) =>
    h(
      ActionProvider,
      { actions: list },
      h(
        FoundationProvider,
        { config, plugins, ui, labels },
        h('main', null, 'Dashboard', h(PluginSlot, { name: 'dashboard' })),
      ),
    );
  try {
    await act(async () => root.render(tree(undefined)));
    assert.match(container.textContent, /Plugin content/);
    assert.ok(list.get('demo.open'));
    await act(async () => root.render(tree([])));
    assert.equal(container.textContent, 'Dashboard');
    assert.equal(pages.size, 0);
    assert.equal(list.getState().actions['demo.open'], undefined);
    await act(async () => root.render(tree(undefined)));
    assert.match(container.textContent, /Plugin content/);
    assert.equal(pages.size, 1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
  assert.equal(pages.size, 0);
});

test('plugin page unmounts when its owner is removed and the host remains', async () => {
  const { PluginPage } = await import('../dist/index.js');
  const list = createActionList();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let cleaned = 0;
  function Page() {
    useEffect(
      () => () => {
        cleaned++;
      },
      [],
    );
    return h('p', null, 'Plugin content');
  }
  const plugin = { id: 'page-demo', pages: [{ path: '/demo', component: Page }] };
  const render = (plugins) =>
    h(
      ActionProvider,
      { actions: list },
      h(
        FoundationProvider,
        { config: { plugins }, ui, labels },
        h('header', null, 'Host'),
        h(PluginPage, { pathname: '/demo', fallback: 'Missing' }),
      ),
    );
  try {
    await act(async () => root.render(render([plugin])));
    assert.match(container.textContent, /HostPlugin content/);
    await act(async () => root.render(render([])));
    assert.match(container.textContent, /HostMissing/);
    assert.equal(cleaned, 1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('ActionButton handles pending while stateful action snapshots update subscribers', async () => {
  const { defineAction, useAction, useFoundationApp, ActionStatus } = await import('../dist/index.js');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const action = defineAction()({ id: 'documents.save', initialState: { count: 0 },
    async execute(input) {
      await gate;
      this.state.update(current => ({count: current.count + input.amount}));
    },
  });
  const config = {actions: [action]};
  function Content() {
    const app = useFoundationApp();
    const save = useAction(app.actions.documents.save);
    return h('div', null,
      h(ActionButton, {action: app.actions.documents.save, input: {amount: 2}}, 'Save'),
      h('output', null, `${save?.status ?? ActionStatus.Idle}:${save?.state.count ?? 0}`));
  }
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(h(FoundationProvider, {config, ui, labels}, h(Content))));
    await act(async () => host.querySelector('button').click());
    assert.equal(host.querySelector('button').disabled, true);
    assert.equal(host.querySelector('output').textContent, 'pending:0');
    await act(async () => release());
    assert.equal(host.querySelector('button').disabled, false);
    assert.equal(host.querySelector('output').textContent, 'succeeded:2');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test('translation hook reacts to stable service updates, interpolates and preserves fallback', async () => {
  const { useTranslation, createTranslationPlugin } = await import('../dist/index.js');
  const makeTranslator = (word) => {
    const t = (key, values) => key === 'greeting' ? `${word} ${values.name}` : key;
    t.has = (key) => key === 'greeting';
    return t;
  };
  const plugin = createTranslationPlugin(makeTranslator('Hallo'));
  const plugins = [plugin];
  function Consumer() {
    const t = useTranslation();
    return h('output', null, t('greeting', { name: 'Ada' }), ' / ', t('missing', undefined, 'Fallback'));
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(h(FoundationProvider, { plugins, ui, labels }, h(Consumer))));
  assert.equal(container.textContent, 'Hallo Ada / Fallback');
  await act(async () => plugin.update(makeTranslator('Hello')));
  assert.equal(container.textContent, 'Hello Ada / Fallback');
  await act(async () => root.unmount());
  plugin.update(makeTranslator('Later'));
  container.remove();
});

test('standard provider replaces plugins in place and appends new plugins without duplicating runtime ownership', async () => {
  const { StandardFoundationProvider } = await import('../dist/components/standard-foundation-provider.js');
  const { useFoundation, definePlugin } = await import('../dist/index.js');
  const first = definePlugin({ id: 'first' });
  const last = definePlugin({ id: 'last' });
  const replacement = definePlugin({ id: 'first', metadata: { name: 'Replacement' } });
  const appended = definePlugin({ id: 'appended' });
  const config = { plugins: [first, last] };
  let observed;
  function Read() { observed = useFoundation().runtime; return null; }
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(StandardFoundationProvider, {
      config, ui, additionalPlugins: [replacement, appended], actionOptions: { shortcuts: false },
    }, h(Read))));
    assert.deepEqual(observed.config.plugins.map(plugin => plugin.id), ['first', 'last', 'appended']);
    assert.equal(observed.config.plugins[0], replacement);
    assert.deepEqual(config.plugins, [first, last]);
  } finally { await act(async () => root.unmount()); }
});

test('event-driven ActionButton and useWatchEvent share the runtime bus and clean up in StrictMode', async () => {
  const { defineAction, useFoundation, useWatchEvent } = await import('../dist/index.js');
  let runtime;
  const received = [];
  const action = defineAction({
    id: 'events.delete', title: 'Delete',
    setup({ events, action }) {
      action.enabled = false;
      events.watch('todos.changed', event => { action.enabled = event.data.count > 0; });
    },
    execute() {},
  });
  const config = { actions: [action] };
  function Consumer({ label, eventName }) {
    runtime = useFoundation().runtime;
    useWatchEvent([eventName], event => { received.push([label, event.data]); });
    return h(ActionButton, { action: 'events.delete' });
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  const tree = (label, eventName = 'todos.changed', selected = config) => h(StrictMode, null,
    h(FoundationProvider, { config: selected, ui, labels }, h(Consumer, { label, eventName })),
  );
  let firstRuntime;
  try {
    await act(async () => root.render(tree('first')));
    firstRuntime = runtime;
    assert.equal(runtime.events.subscriptionCount, 2);
    assert.equal(host.querySelector('button').disabled, true);
    await act(async () => runtime.events.emit('todos.changed', { count: 1 }));
    assert.equal(host.querySelector('button').disabled, false);
    assert.deepEqual(received, [['first', { count: 1 }]]);
    await act(async () => root.render(tree('latest')));
    assert.equal(runtime.events.subscriptionCount, 2);
    await act(async () => runtime.events.emit('todos.changed', { count: 0 }));
    assert.equal(host.querySelector('button').disabled, true);
    assert.deepEqual(received.at(-1), ['latest', { count: 0 }]);
    await act(async () => root.render(tree('other', 'other')));
    await act(async () => runtime.events.emit('todos.changed', { count: 1 }));
    assert.equal(received.length, 2);
    await act(async () => runtime.events.emit('other', 42));
    assert.deepEqual(received.at(-1), ['other', 42]);
    await act(async () => root.render(tree('replacement', 'other', { actions: [action] })));
    assert.notEqual(runtime, firstRuntime);
    assert.equal(firstRuntime.events.subscriptionCount, 0);
    assert.equal(runtime.events.subscriptionCount, 2);
  } finally {
    await act(async () => root.unmount());
  }
  assert.equal(runtime.events.subscriptionCount, 0);
  const count = received.length;
  runtime.events.emit('other', 99);
  assert.equal(received.length, count);
});

test('two Add buttons derive availability from their own current input without events', async () => {
  const { defineAction } = await import('../dist/index.js');
  const received = [];
  const config = { actions: [defineAction({
    id: 'todos.add', title: 'Add',
    resolve: input => ({ enabled: typeof input === 'string' && input.length > 0 }),
    execute: ({ input }) => { received.push(input); },
  })] };
  const host = document.createElement('div');
  const root = createRoot(host);
  const tree = (first, second) => h(FoundationProvider, { config, ui, labels },
    h(ActionButton, { action: 'todos.add', input: first }),
    h(ActionButton, { action: 'todos.add', input: second }),
  );
  try {
    await act(async () => root.render(tree('', 'Second')));
    let buttons = host.querySelectorAll('button');
    assert.equal(buttons[0].disabled, true);
    assert.equal(buttons[1].disabled, false);
    await act(async () => root.render(tree('First', '')));
    buttons = host.querySelectorAll('button');
    assert.equal(buttons[0].disabled, false);
    assert.equal(buttons[1].disabled, true);
    await act(async () => buttons[0].click());
    assert.deepEqual(received, ['First']);
  } finally {
    await act(async () => root.unmount());
  }
});

test('group headings use the title the app gave a group ID, even from an untitled snapshot group', async () => {
  const { ActionGroup, defineAction, useActionList, useGroupTitle } = await import('../dist/index.js');
  // The plain name registers first, so this action's snapshot holds an untitled group object.
  const plugins = [
    {
      id: 'todos',
      actions: [
        defineAction({ id: 'todos.clear', title: 'Clear', groups: ['todos.bulk'], execute() {} }),
        defineAction({
          id: 'todos.export',
          title: 'Export',
          groups: [new ActionGroup('todos.bulk', 'Bulk actions')],
          execute() {},
        }),
        defineAction({ id: 'todos.open', title: 'Open', groups: ['navigation'], execute() {} }),
      ],
    },
  ];
  const headings = [];
  function Headings() {
    const groupTitle = useGroupTitle();
    const list = useActionList();
    const clear = list.get('todos.clear');
    const open = list.get('todos.open');
    if (clear && open) headings.push(groupTitle(clear.groups[0]), groupTitle(open.groups[0]), groupTitle({ id: 'other' }));
    return null;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(h(FoundationProvider, { plugins, ui, labels }, h(Headings))));
    assert.deepEqual(headings.slice(-3), ['Bulk actions', 'General', 'other']);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
