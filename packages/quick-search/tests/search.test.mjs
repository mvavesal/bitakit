import { registerHooks } from 'node:module';
registerHooks({
  load(url, context, next) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : next(url, context);
  },
});
import test from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Document',
  'DocumentFragment',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'SVGElement',
  'NodeFilter',
])
  globalThis[key] =
    key === 'window' ? dom.window : key === 'document' ? dom.window.document : dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '_') };
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');

globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
HTMLElement.prototype.scrollIntoView = function () {};
const { BitaKitRuntimeProvider, useBitaKit } = await import('@bitakit/ui');
const { AppBar, standardBitaKitUI } = await import('@bitakit/ui/components');
const { createActionList, ActionGroup } = await import('@bitakit/core');
const { quickSearchPlugin } = await import('../dist/plugin.js');

test('automatic AppBar trigger, URL-only search, metadata, native links and live cleanup', async () => {
  const list = createActionList();
  const group = new ActionGroup('workspace', 'Workspace');
  const remove = list.register({
    id: 'reports',
    title: 'Reports',
    description: 'Monthly revenue',
    href: '/reports',
    groups: [group],
    shortcut: { keys: 'Mod+R' },
  });
  list.register({ id: 'hidden', title: 'Hidden', href: '/hidden', visible: false });
  list.register({ id: 'internal', title: 'Internal', href: '/internal', internal: true });
  assert.throws(() =>
    list.register({ id: 'unsafe', title: 'Unsafe', href: 'javascript:alert(1)' }),
  );
  list.register({ id: 'command', title: 'Command only', execute() {} });
  list.register({ id: 'disabled', title: 'Disabled', href: '/disabled', enabled: false });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const plugins = [quickSearchPlugin()];
  try {
    await act(async () =>
      root.render(
        h(
          BitaKitRuntimeProvider,
          {
            plugins,
            actionOptions: { list, shortcuts: false },
            ui: standardBitaKitUI,
            labels: {
              cancel: 'Cancel',
              submit: 'Submit',
              pending: 'Pending',
              invalid: 'Invalid',
              unavailable: 'Unavailable',
            },
          },
          h(AppBar),
        ),
      ),
    );
    const trigger = container.querySelector('button');
    assert.match(trigger.textContent, /Quick search/);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
    assert.ok(trigger.querySelector('svg[aria-hidden="true"]'));
    assert.equal(container.querySelector('input'), null);
    await act(async () => trigger.click());
    assert.ok(document.querySelector('[role=dialog]'));
    // The command frame: the search field is the header; the title stays for assistive technology.
    assert.equal(document.querySelector('[data-slot=dialog-close]'), null);
    assert.match(document.querySelector('[data-slot=dialog-header]').className, /\bsr-only\b/);
    assert.equal(document.querySelector('[data-slot=dialog-title]').textContent, 'Quick search');
    assert.equal(document.activeElement.getAttribute('role'), 'combobox');
    assert.match(document.body.textContent, /Monthly revenue/);
    assert.match(document.body.textContent, /Workspace/);
    assert.equal(
      document.querySelector('a[href="/reports"]').textContent.includes('Reports'),
      true,
    );
    for (const href of ['/hidden', '/internal', 'javascript:alert(1)'])
      assert.equal(document.querySelector(`a[href="${href}"]`), null);
    assert.ok(document.querySelector('[cmdk-item][data-disabled=true]'));
    const input = document.querySelector('[cmdk-input]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        input,
        'revenue',
      );
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(document.querySelectorAll('[cmdk-item]').length, 1);
    // Mod+Enter opens the selected result in a new tab and keeps the dialog and page as they are.
    const opened = [];
    const open = window.open;
    window.open = (...args) => opened.push(args);
    try {
      await act(async () =>
        input.dispatchEvent(
          new window.KeyboardEvent('keydown', {
            key: 'Enter',
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
    } finally {
      window.open = open;
    }
    assert.deepEqual(opened, [['http://localhost/reports', '_blank', 'noopener']]);
    assert.ok(document.querySelector('[role=dialog]'));
    assert.ok(document.querySelector('[role=dialog] button[aria-label="Close"]'));
    await act(async () => remove.unregister());
    assert.match(document.body.textContent, /No results found/);
    await act(async () =>
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    assert.equal(document.querySelector('[role=dialog]'), null);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

const labels = {
  cancel: 'Cancel',
  submit: 'Submit',
  pending: 'Pending',
  invalid: 'Invalid',
  unavailable: 'Unavailable',
};
/** Renders an app with quick search, opens it and returns helpers to read and drive the results. */
function Capture({ report }) {
  report(useBitaKit().runtime);
  return null;
}
async function openSearch({ plugins = [], list = createActionList(), results, content } = {}) {
  let runtime;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      h(
        BitaKitRuntimeProvider,
        {
          plugins: [quickSearchPlugin({ results }), ...plugins],
          actionOptions: { list, shortcuts: false },
          ui: standardBitaKitUI,
          labels,
        },
        h(AppBar),
        content,
        h(Capture, {
          report: (value) => {
            runtime = value;
          },
        }),
      ),
    ),
  );
  await act(async () => container.querySelector('button').click());
  return {
    list,
    runtime,
    container,
    ids: () =>
      [...document.querySelectorAll('[cmdk-item]')]
        .map((item) => item.getAttribute('data-value'))
        .sort(),
    async close() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test('results name their type and owning plugin, derived from existing registrations', async () => {
  const { SearchSettingsPage } = await import('../dist/ui/settings/page.js');
  const { defineAction: defineURLAction, destinationMetadata } = await import('@bitakit/core');
  const list = createActionList();
  // What the settings catalog and a plugin overview project; developers never declare these.
  list.register({
    id: 'alerts',
    title: 'Notifications',
    href: '/settings/alerts',
    metadata: destinationMetadata({ kind: 'settings', plugin: 'todos' }),
  });
  list.register({
    id: 'overview',
    title: 'Todos',
    href: '/settings/plugins?plugin=todos',
    metadata: destinationMetadata({ kind: 'plugin', plugin: 'todos' }),
  });
  list.register({
    id: 'alerts.shortcut',
    title: 'Alerts',
    href: '/settings/alerts',
    shortcut: { keys: 'Mod+J' },
  });
  list.register({ id: 'home', title: 'Home', href: '/' });
  list.register({ id: 'docs', title: 'Docs', href: 'https://example.com/docs' });
  const todos = {
    id: 'todos',
    metadata: { name: 'Todos' },
    pages: [{ path: '/todos/tasks', component: () => null }],
    actions: [defineURLAction({ id: 'todos.tasks', title: 'Tasks', href: '/todos/tasks' })],
  };
  const search = await openSearch({
    plugins: [todos],
    list,
    results: { plugins: true },
    content: h(SearchSettingsPage),
  });
  try {
    const kind = (href) =>
      document.querySelector(`a[href="${href}"] .quick-search-kind`)?.textContent;
    const sourceSwitch = search.container.querySelector(
      '[data-setting="quick-search.showSource"] [role="switch"]',
    );
    assert.ok(sourceSwitch);
    assert.equal(sourceSwitch.getAttribute('aria-checked'), 'false');
    assert.equal(document.querySelector('.quick-search-kind'), null);
    assert.ok(document.querySelector('a[href="/settings/alerts"] .quick-search-shortcut'));
    await act(async () => sourceSwitch.click());
    assert.equal(search.runtime.settings.get('quick-search.showSource'), true);
    assert.equal(kind('/todos/tasks'), 'Page · Todos');
    // Duplicate destinations merge: the shortcut Action is shown, the settings type is kept.
    assert.equal(kind('/settings/alerts'), 'Settings · Todos');
    assert.match(document.querySelector('a[href="/settings/alerts"]').textContent, /Alerts/);
    assert.equal(document.querySelectorAll('a[href="/settings/alerts"]').length, 1);
    // A plugin is its own owner; application pages and external links name no plugin.
    assert.equal(kind('/settings/plugins?plugin=todos'), 'Plugin');
    assert.equal(kind('/'), 'Page');
    assert.equal(kind('https://example.com/docs'), undefined);
    const input = document.querySelector('[cmdk-input]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        input,
        'todos',
      );
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    // Searching for the plugin finds everything it owns, including results whose IDs do not say so.
    assert.deepEqual(
      [...document.querySelectorAll('[cmdk-item] a')]
        .map((link) => link.getAttribute('href'))
        .sort(),
      ['/settings/alerts', '/settings/plugins?plugin=todos', '/todos/tasks'],
    );
    await act(async () => sourceSwitch.click());
    assert.equal(search.runtime.settings.get('quick-search.showSource'), false);
    assert.equal(document.querySelector('.quick-search-kind'), null);
    assert.equal(document.querySelectorAll('[cmdk-item] a').length, 3);
    assert.ok(document.querySelector('a[href="/settings/alerts"] .quick-search-shortcut'));
  } finally {
    await search.close();
  }
});

test('each result type has its own switch; turning one off never hides another', async () => {
  const { defineAction, destinationMetadata } = await import('@bitakit/core');
  const defineURLAction = defineAction;
  const todos = {
    id: 'todos',
    metadata: { name: 'Todos' },
    pages: [{ path: '/todos/tasks', component: () => null }],
    actions: [
      defineURLAction({ id: 'todos.tasks', title: 'Tasks', href: '/todos/tasks' }),
      // An Action without a URL is never a result, whatever the switches say.
      defineAction({ id: 'todos.archive', title: 'Archive done', execute: () => {} }),
    ],
  };
  const projected = () => {
    const list = createActionList();
    list.register({
      id: 'alerts',
      title: 'Notifications',
      href: '/settings/alerts',
      metadata: destinationMetadata({ kind: 'settings', plugin: 'todos' }),
    });
    list.register({
      id: 'overview',
      title: 'Todos',
      href: '/settings/plugins?plugin=todos',
      metadata: destinationMetadata({ kind: 'plugin', plugin: 'todos' }),
    });
    return list;
  };
  const cases = [
    // All destination types are included unless explicitly disabled.
    [undefined, ['alerts', 'overview', 'todos.tasks']],
    [{ plugins: true }, ['alerts', 'overview', 'todos.tasks']],
    // Plugin results off never hides the plugin's own pages or settings.
    [{ plugins: false }, ['alerts', 'todos.tasks']],
    [{ settings: false }, ['overview', 'todos.tasks']],
    [{ pages: false }, ['alerts', 'overview']],
    [{ pages: false, settings: false, plugins: true }, ['overview']],
  ];
  for (const [results, expected] of cases) {
    const search = await openSearch({ plugins: [todos], list: projected(), results });
    try {
      assert.deepEqual(search.ids(), expected, JSON.stringify(results));
    } finally {
      await search.close();
    }
  }
});

test('only navigation links are results: Actions without a URL never appear, even those that need input', async () => {
  const { defineAction } = await import('@bitakit/core');
  const runs = [];
  const todos = {
    id: 'todos',
    metadata: { name: 'Todos' },
    actions: [
      defineAction({
        id: 'todos.archive',
        title: 'Archive done',
        execute: () => void runs.push('archive'),
      }),
      // Needs input and does not hide itself without it.
      defineAction({
        id: 'todos.rename',
        title: 'Rename',
        execute: ({ input }) => void runs.push(`rename ${input.title}`),
      }),
      defineAction({ id: 'todos.details', title: 'Task details', dialog: () => null }),
      defineAction({
        id: 'todos.create',
        title: 'New task',
        input: {
          parse: (value) => {
            if (!value?.title) throw new Error('A title is required.');
            return value;
          },
        },
        execute: () => {},
      }),
    ],
  };
  const list = createActionList();
  list.register({ id: 'dark', title: 'Dark mode', checked: false, execute: () => {} });
  list.register({ id: 'reports', title: 'Reports', href: '/reports' });
  const search = await openSearch({
    plugins: [todos],
    list,
    results: { pages: true, settings: true, plugins: true },
  });
  try {
    assert.deepEqual(search.ids(), ['reports']);
    const input = document.querySelector('[cmdk-input]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        input,
        'rename',
      );
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.deepEqual(search.ids(), []);
    assert.match(document.body.textContent, /No results found/);
    assert.deepEqual(runs, []);
  } finally {
    await search.close();
  }
});

test('Settings source choices update open search and retain confirmed values after failed saves', async () => {
  const { SearchSettingsPage } = await import('../dist/ui/settings/page.js');
  const { defineService, settingsStorage, createMemorySettingsStorage } = await import(
    '@bitakit/core'
  );
  const memory = createMemorySettingsStorage();
  let fail = false;
  let calls = 0;
  const catalog = {
    id: 'catalog',
    setup({ scope }) {
      scope.slots.attach(
        {
          slot: 'quick-search.sources',
          id: 'lessons',
          data: {
            title: 'Learning catalog',
            icon: (props) => h('svg', { ...props, 'data-source-icon': 'custom' }),
            description: 'Plugin supplied description',
            category: { id: 'learning', title: 'Learning' },
            defaultEnabled: false,
            search() {
              calls++;
              return [{ id: 'intro', title: 'Introduction', href: '/intro' }];
            },
            resolve() {
              return null;
            },
          },
        },
        { availability: 'wait' },
      );
    },
  };
  const storage = {
    id: 'storage',
    services: {
      storage: defineService(
        () => ({
          ...memory,
          save(key, value, context) {
            if (fail) throw new Error('storage unavailable');
            memory.save(key, value, context);
          },
        }),
        { provides: settingsStorage },
      ),
    },
  };
  const search = await openSearch({ plugins: [catalog, storage], content: h(SearchSettingsPage) });
  try {
    assert.equal(calls, 0);
    await act(async () => document.querySelector('[role=dialog] button[aria-label=Close]').click());
    const settingSwitch = () =>
      [...search.container.querySelectorAll('[role=switch]')].find((item) =>
        item.parentElement.textContent.includes('Learning catalog'),
      );
    assert.equal(settingSwitch().getAttribute('aria-checked'), 'false');
    await act(async () => settingSwitch().click());
    assert.equal(settingSwitch().getAttribute('aria-checked'), 'true');
    await act(async () => search.container.querySelector('button[aria-haspopup=dialog]').click());
    assert.ok(document.querySelector('[role=dialog] a[href="/intro"]'));
    const controls = document.querySelector('[role=dialog] .quick-search-controls');
    assert.equal(
      controls.querySelectorAll('button').length,
      1,
      'only the category dropdown remains',
    );
    assert.equal(document.querySelector('[role=dialog] [aria-pressed]'), null);
    assert.ok(
      settingSwitch().parentElement.querySelector('svg[data-source-icon=custom][aria-hidden=true]'),
    );
    fail = true;
    await act(async () => settingSwitch().click());
    assert.equal(
      settingSwitch().getAttribute('aria-checked'),
      'true',
      'failed save retains confirmed choice',
    );
    assert.match(search.container.textContent, /Could not save your preference/);
    fail = false;
    await act(async () => settingSwitch().click());
    assert.equal(settingSwitch().getAttribute('aria-checked'), 'false');
    assert.equal(document.querySelector('[role=dialog] a[href="/intro"]'), null);
  } finally {
    await search.close();
  }
});

test('an Action becoming disabled during the click is neither opened nor recorded', async () => {
  const list = createActionList();
  list.register({ id: 'race', title: 'Race', href: '/race' });
  const search = await openSearch({ list });
  try {
    const link = document.querySelector('[role=dialog] a[href="/race"]');
    link.addEventListener('click', () => list.update('race', { enabled: false }), {
      capture: true,
      once: true,
    });
    let allowed;
    await act(async () => {
      allowed = link.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });
    assert.equal(allowed, false);
    assert.ok(document.querySelector('[role=dialog]'));
    assert.deepEqual(search.runtime.settings.get('quick-search.history').results, []);
  } finally {
    await search.close();
  }
});

test('recently opened visibility defaults off and does not change saved history', async () => {
  const { SearchSettingsPage } = await import('../dist/ui/settings/page.js');
  const list = createActionList();
  const registration = list.register({
    id: 'recent-report',
    title: 'Recent report',
    href: '/recent-report',
  });
  const search = await openSearch({ list, content: h(SearchSettingsPage) });
  try {
    const service = search.runtime.services['quick-search'].search;
    const state = service.state.get();
    const entry = state.sources.find((source) =>
      source.results.some((result) => result.id === 'recent-report'),
    );
    assert.ok(entry);
    await act(async () =>
      service.remember(
        state.request,
        entry.source.id,
        entry.results.find((result) => result.id === 'recent-report'),
      ),
    );
    const saved = search.runtime.settings.get('quick-search.history');
    assert.equal(saved.results.length, 1, 'recording continues while the section is hidden');
    assert.equal(search.runtime.settings.get('quick-search.showRecentResults'), false);
    assert.doesNotMatch(document.querySelector('[role=dialog]').textContent, /Recently opened/);
    const toggle = search.container.querySelector(
      '[data-setting="quick-search.showRecentResults"] [role=switch]',
    );
    await act(async () => toggle.click());
    assert.match(document.querySelector('[role=dialog]').textContent, /Recently opened/);
    assert.deepEqual(search.runtime.settings.get('quick-search.history'), saved);
    assert.equal(search.runtime.settings.get('quick-search.historyEnabled'), true);
    await act(async () => toggle.click());
    assert.doesNotMatch(document.querySelector('[role=dialog]').textContent, /Recently opened/);
    assert.deepEqual(search.runtime.settings.get('quick-search.history'), saved);
    await act(async () => toggle.click());
    await act(async () => registration.unregister());
    assert.equal(
      document.querySelector('a[href="/recent-report"]'),
      null,
      'removed results remain unavailable even with recents enabled',
    );
  } finally {
    await search.close();
  }
});
