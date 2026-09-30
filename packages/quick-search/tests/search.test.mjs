import { registerHooks } from 'node:module';
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); } });
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
HTMLElement.prototype.scrollIntoView = function() {};
const { FoundationProvider } = await import('@bitakit/ui');
const { AppBar, standardFoundationUI } = await import('@bitakit/ui/components');
const { createActionList, ActionGroup } = await import('@bitakit/core');
const { quickSearchPlugin } = await import('../dist/plugin.js');

test('automatic AppBar trigger, URL-only search, metadata, native links and live cleanup', async () => {
  const list = createActionList();
  const group = new ActionGroup('workspace', 'Workspace');
  const remove = list.register({ id: 'reports', title: 'Reports', description: 'Monthly revenue', href: '/reports', groups: [group], shortcut: { keys: 'Mod+R' } });
  list.register({ id: 'hidden', title: 'Hidden', href: '/hidden', visible: false });
  list.register({ id: 'internal', title: 'Internal', href: '/internal', internal: true });
  assert.throws(() => list.register({ id: 'unsafe', title: 'Unsafe', href: 'javascript:alert(1)' }));
  list.register({ id: 'command', title: 'Command only', execute() {} });
  list.register({ id: 'disabled', title: 'Disabled', href: '/disabled', enabled: false });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const plugins = [quickSearchPlugin()];
  try {
    await act(async () => root.render(h(FoundationProvider, {
      plugins, actionOptions: { list, shortcuts: false }, ui: standardFoundationUI,
      labels: { cancel: 'Cancel', submit: 'Submit', pending: 'Pending', invalid: 'Invalid', unavailable: 'Unavailable' },
    }, h(AppBar))));
    const trigger = container.querySelector('button');
    assert.match(trigger.textContent, /Schnellsuche/);
    assert.equal(container.querySelector('input'), null);
    await act(async () => trigger.click());
    assert.ok(document.querySelector('[role=dialog]'));
    assert.equal(document.activeElement.getAttribute('role'), 'combobox');
    assert.match(document.body.textContent, /Monthly revenue/);
    assert.match(document.body.textContent, /Workspace/);
    assert.equal(document.querySelector('a[href="/reports"]').textContent.includes('Reports'), true);
    for (const href of ['/hidden', '/internal', 'javascript:alert(1)']) assert.equal(document.querySelector(`a[href="${href}"]`), null);
    assert.ok(document.querySelector('[cmdk-item][data-disabled=true]'));
    const input = document.querySelector('[cmdk-input]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'revenue');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(document.querySelectorAll('[cmdk-item]').length, 1);
    await act(async () => remove.unregister());
    assert.match(document.body.textContent, /Keine Ergebnisse/);
    await act(async () => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role=dialog]'), null);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
