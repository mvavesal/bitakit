import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { installDom, click, silenced, testUI } from './support.mjs';
import { PluginPage, useService, useServiceState } from '../dist/index.js';
import {
  defineAction,
  defineEvents,
  definePlugin,
  defineService,
  event,
  isBitaKitStartupError,
} from '@bitakit/core';
import { renderWithBitaKit } from '../dist/testing/index.js';

installDom();

/** A plugin with a service, events, an action and a page, shaped like the ones `bitakit add plugin` creates. */
const notes = definePlugin({
  id: 'notes',
  events: defineEvents({ opened: event(), added: event() }),
  services: {
    items: defineService(({ store, events, onStart }) => {
      const state = store({ titles: [] });
      onStart(() => events.emit('notes.opened'));
      return {
        state,
        add(title) {
          state.set((current) => ({ titles: [...current.titles, title] }));
          events.emit('notes.added', { title });
        },
      };
    }),
  },
  actions: {
    add: defineAction({ execute: ({ services }) => services.notes.items.add('From the action') }),
  },
  ui: {
    pages: [
      {
        path: '/notes',
        component: function NotesPage() {
          const items = useService('notes.items');
          const titles = useServiceState('notes.items', (state) => state.titles, []);
          return h(
            'section',
            null,
            h('output', null, titles.join(', ') || 'No notes'),
            h('button', { onClick: () => items.add('Write tests') }, 'Add'),
          );
        },
      },
    ],
  },
});

test('renderWithBitaKit mounts a plugin page, records events from startup on and releases everything on unmount', async () => {
  const view = await renderWithBitaKit(h(PluginPage, { pathname: '/notes' }), {
    plugins: [notes],
    ui: testUI,
  });
  try {
    assert.equal(view.runtime.app.ready, true, 'the helper resolves after every start hook');
    assert.equal(view.container.querySelector('output').textContent, 'No notes');
    await click(view.container.querySelector('button'));
    assert.equal(view.container.querySelector('output').textContent, 'Write tests');
    await act(async () => view.runtime.actions.execute('notes.add'));
    assert.deepEqual(
      view.events.recorded.filter((event) => event.type !== 'runtime.lifecycle'),
      [
        { type: 'notes.opened', data: undefined },
        { type: 'notes.added', data: { title: 'Write tests' } },
        { type: 'notes.added', data: { title: 'From the action' } },
      ],
    );
    await view.rerender(h('p', null, 'Elsewhere'));
    assert.equal(view.container.textContent, 'Elsewhere');
  } finally {
    await view.unmount();
  }
  assert.equal(view.container.isConnected, false);
  assert.equal(view.runtime.app.ready, false, 'the runtime stops with the view');
  await view.unmount();
});

test('renderWithBitaKit adds plugins to a configuration, passes host services and rejects with the startup error', async () => {
  const config = { plugins: [notes] };
  const stats = definePlugin({
    id: 'stats',
    services: { total: defineService(({ services }) => ({ greeting: services.greeter.hello })) },
  });
  const view = await renderWithBitaKit(h('p', null, 'Host'), {
    config,
    plugins: [stats],
    services: { greeter: { hello: 'Hi' } },
    ui: testUI,
  });
  try {
    assert.equal(view.runtime.services.stats.total.greeting, 'Hi');
    assert.ok(view.runtime.services.notes.items, 'the configuration keeps its own plugins');
  } finally {
    await view.unmount();
  }

  const failing = definePlugin({
    id: 'queue',
    services: {
      worker: defineService(({ onStart }) => {
        onStart(() => {
          throw new Error('queue unavailable');
        });
        return {};
      }),
    },
  });
  const before = document.body.children.length;
  const { value, errors } = await silenced(() =>
    renderWithBitaKit(h('p', null, 'Host'), { plugins: [failing], ui: testUI }).then(
      () => undefined,
      (error) => error,
    ),
  );
  assert.ok(isBitaKitStartupError(value), errors.join('\n'));
  assert.equal(value.plugin, 'queue');
  assert.match(value.message, /onStart in plugin "queue" failed: queue unavailable/);
  assert.equal(document.body.children.length, before, 'a failed start leaves nothing mounted');
});
