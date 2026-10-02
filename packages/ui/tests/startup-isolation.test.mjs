import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionProvider, ActionButton, createActionList } from '@bitakit/ui/actions';
import { FoundationProvider, defineAction, defineService, useFoundationApp } from '../dist/index.js';

const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const box = ({ children }) => h('div', null, children);
const ui = {
  Dialog: ({ children }) => h('section', { role: 'dialog' }, children),
  DialogContent: box,
  DialogHeader: box,
  DialogTitle: ({ children }) => h('h2', null, children),
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
const labels = { cancel: 'Cancel', submit: 'Submit', pending: 'Pending', invalid: 'Invalid', unavailable: 'Unavailable' };
const healthy = { id: 'healthy', actions: [defineAction({ id: 'healthy.ping', title: 'Ping', execute: () => 'pong' })] };
const broken = {
  id: 'broken',
  services: [defineService({ id: 'broken.store', create: () => { throw new Error('database offline'); } })],
};
const dependent = { id: 'dependent', dependencies: ['broken'], actions: [defineAction({ id: 'dependent.go', execute: () => {} })] };

async function render(props, content = h('main', null, h(ActionButton, { action: 'healthy.ping' }))) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const list = createActionList();
  const errors = [];
  const error = console.error;
  console.error = (message) => errors.push(String(message));
  try {
    await act(async () =>
      root.render(h(ActionProvider, { actions: list }, h(FoundationProvider, { ui, labels, ...props }, content))),
    );
  } finally {
    console.error = error;
  }
  return {
    container,
    list,
    errors,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test('development isolation turns off a failing plugin and its dependents and keeps the app running', async () => {
  const view = await render({ isolateFailures: true, plugins: [healthy, broken, dependent] });
  try {
    assert.equal(view.list.get('healthy.ping')?.enabled, true);
    assert.equal(view.list.get('dependent.go'), undefined);
    assert.ok(view.container.querySelector('main button'), 'the rest of the app renders');
    const dialog = view.container.querySelector('[role=dialog]');
    assert.match(dialog.textContent, /Plugin "broken" was turned off/);
    assert.match(dialog.textContent, /Service "broken.store" in plugin "broken" failed to start: database offline/);
    assert.match(dialog.textContent, /Also turned off because they depend on it: dependent\./);
    assert.ok(view.errors.some((message) => /database offline/.test(message)));
    const dismiss = [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Dismiss');
    await act(async () => dismiss.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(view.container.querySelector('[role=dialog]'), null);
    assert.equal((await view.list.execute('healthy.ping')).value, 'pong');
  } finally {
    await view.cleanup();
  }
});

test('construction-time conflicts are isolated to the plugin that introduced them', async () => {
  const one = { id: 'one', services: [defineService({ id: 'one.store', exposeAs: 'store', create: () => ({}) })] };
  const two = { id: 'two', services: [defineService({ id: 'two.store', exposeAs: 'store', create: () => ({}) })] };
  const view = await render({ isolateFailures: true, plugins: [healthy, one, two] });
  try {
    assert.match(view.container.textContent, /Plugin "two" was turned off/);
    assert.match(view.container.textContent, /Plugins "one" and "two" both expose a service named "store"/);
    assert.equal(view.list.get('healthy.ping')?.enabled, true);
  } finally {
    await view.cleanup();
  }
});

test('an application-level failure shows the fatal report instead of a broken page', async () => {
  const view = await render({
    isolateFailures: true,
    plugins: [healthy],
    actions: [defineAction({ id: 'report', requires: ['missing'], execute: () => {} })],
  });
  try {
    assert.match(view.container.textContent, /The app failed to start/);
    assert.match(view.container.textContent, /Action "report" requires service "missing"/);
    assert.equal(view.container.querySelector('main'), null);
  } finally {
    await view.cleanup();
  }
});

test('a host component that still requires a turned-off plugin service gets an actionable report', async () => {
  const inventory = {
    id: 'inventory',
    services: [defineService({ id: 'inventory.items', exposeAs: 'stock', create: () => { throw new Error('database offline'); } })],
  };
  // A correct host component: it waits for readiness, then requires the service.
  function Stock() {
    const app = useFoundationApp();
    return h('p', null, app.ready ? `${app.services.stock.count()} items` : 'Loading');
  }
  const view = await render({ isolateFailures: true, plugins: [healthy, inventory] }, h('main', null, h(Stock)));
  try {
    const notice = view.container.querySelector('[role=alert]');
    assert.match(notice.textContent, /requires the service "stock" from plugin "inventory", which was turned off because it failed to start/);
    assert.match(notice.textContent, /app\.optional\.services\.stock/);
    const dialog = view.container.querySelector('[role=dialog]');
    assert.match(dialog.textContent, /Service "inventory.items" in plugin "inventory" failed to start: database offline/);
    assert.ok(view.errors.some((message) => /requires the service "stock" from plugin "inventory"/.test(message)));
    assert.equal((await view.list.execute('healthy.ping')).value, 'pong');
  } finally {
    await view.cleanup();
  }
  // A plugin turned off only because it depends on the failed one is named as such.
  const reports = {
    id: 'reports',
    dependencies: ['inventory'],
    services: [defineService({ id: 'reports.summary', exposeAs: 'summary', create: () => ({ total: () => 0 }) })],
  };
  function Summary() {
    const app = useFoundationApp();
    return h('p', null, app.ready ? String(app.services.summary.total()) : 'Loading');
  }
  const dependent = await render({ isolateFailures: true, plugins: [healthy, inventory, reports] }, h(Summary));
  try {
    assert.match(
      dependent.container.querySelector('[role=alert]').textContent,
      /service "summary" from plugin "reports", which was turned off because it depends on a plugin that failed to start/,
    );
  } finally {
    await dependent.cleanup();
  }
  // Errors unrelated to the turned-off plugin still reach the host as before.
  function Broken() {
    throw new Error('component bug');
  }
  await assert.rejects(
    () => render({ isolateFailures: true, plugins: [healthy, inventory] }, h(Broken)),
    /component bug/,
  );
});

test('without isolation the startup error propagates as before', async () => {
  await assert.rejects(
    () => render({ isolateFailures: false, plugins: [healthy, broken] }),
    /Service "broken.store" in plugin "broken" failed to start: database offline/,
  );
});
