import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// React DOM detects input events when it loads, so the DOM must exist before importing it.
const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const key of [
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'MutationObserver',
])
  globalThis[key] = dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { BitaKitRuntimeProvider } = await import('@bitakit/ui');
const { defineAction, defineService } = await import('@bitakit/core');
const { standardBitaKitUI } = await import('@bitakit/ui/components');
const { Inspector } = await import('../dist/index.js');
const labels = {
  cancel: 'Cancel',
  submit: 'Save',
  pending: 'Saving',
  invalid: 'Invalid',
  unavailable: 'Unavailable',
};

const notes = {
  id: 'notes',
  metadata: { title: 'Notes', name: '@acme/notes', version: '1.2.3' },
  services: [
    // services.notes.notes: a plugin's services live under its own namespace.
    defineService(
      ({ events }) => {
        const items = [];
        return {
          list: () => items,
          add(title) {
            items.push(title);
            events.emit('notes.changed', { count: items.length });
          },
        };
      },
      { id: 'notes.notes' },
    ),
  ],
  actions: [
    defineAction({
      id: 'notes.add',
      title: 'Add note',
      requires: ['notes.notes'],
      execute: ({ services, input }) => {
        services.notes.notes.add(input);
        return services.notes.notes.list().length;
      },
    }),
  ],
  ui: { pages: [{ path: '/notes', component: () => null }] },
};

test('the inspector shows a running plugin and runs its actions with JSON input', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        h(
          BitaKitRuntimeProvider,
          { ui: standardBitaKitUI, labels, plugins: [notes] },
          h(Inspector, { plugin: 'notes' }),
        ),
      ),
    );
    const text = () => container.textContent;
    assert.match(text(), /Notes/);
    assert.match(text(), /1\.2\.3/);
    assert.match(text(), /\/notes/);
    assert.match(text(), /Add notenotes\.add/);
    assert.match(text(), /services\.notes\.notesnotes\.notes/);
    assert.match(text(), /add, list|list, add/);
    const input = container.querySelector('input[aria-label="Input for notes.add"]');
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ).set;
    await act(async () => {
      setValue.call(input, '"Buy milk"');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const run = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Run',
    );
    await act(async () => run.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.match(container.querySelector('[role=status]').textContent, /Completed: 1/);
    assert.match(text(), /notes\.changed\{"count":1\}/);
    const current = container.querySelector('input[aria-label="Input for notes.add"]');
    await act(async () => {
      setValue.call(current, '{oops');
      current.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(current.value, '{oops', `same element: ${current === input}`);
    const again = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Run',
    );
    await act(async () => again.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    const statuses = [...container.querySelectorAll('[role=status]')].map(
      (node) => node.textContent,
    );
    assert.ok(
      statuses.some((status) => /not valid JSON/.test(status)),
      statuses.join(' | '),
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('an unknown plugin explains what to check', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () =>
    root.render(
      h(
        BitaKitRuntimeProvider,
        { ui: standardBitaKitUI, labels, plugins: [] },
        h(Inspector, { plugin: 'missing' }),
      ),
    ),
  );
  assert.match(container.textContent, /Plugin "missing" is not running/);
  await act(async () => root.unmount());
});
