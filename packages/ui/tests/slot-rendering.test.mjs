import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { defineAction, definePlugin, defineService, defineSlot } from '@bitakit/core';
import {
  BitaKitRuntimeProvider,
  PluginSlot,
  useBitaKit,
  useService,
  useSlot,
} from '../dist/index.js';
import { installDom, mount, testUI } from './support.mjs';

installDom();

// A service whose store the runtime observes: every change re-evaluates Action presentation.
const counter = defineService(({ store }) => {
  const state = store({ n: 0 });
  return { state, bump: () => state.set((current) => ({ n: current.n + 1 })) };
});

test('component outlets do not render again when an Action runs or a service store changes', async () => {
  const renders = { card: 0 };
  function Card() {
    renders.card++;
    return h('b', null, 'card');
  }
  const config = {
    slots: { cards: defineSlot({ accepts: 'component' }) },
    plugins: [
      definePlugin({
        id: 'demo',
        services: { counter },
        actions: {
          work: defineAction({
            title: ({ services }) => `Work ${services.demo.counter.state.get().n}`,
            execute: async () => {},
          }),
        },
        ui: { slots: [{ slot: 'cards', component: Card }] },
      }),
    ],
  };
  let runtime, service;
  function Capture() {
    runtime = useBitaKit().runtime;
    service = useService('demo.counter');
    return null;
  }
  const outlets = Array.from({ length: 40 }, (_, index) =>
    h(PluginSlot, { key: index, name: 'cards' }),
  );
  const view = await mount(
    h(BitaKitRuntimeProvider, { config, ui: testUI }, h(Capture), ...outlets),
  );
  try {
    await act(async () => {
      await runtime.ready;
    });
    assert.equal(view.container.querySelectorAll('b').length, 40);
    const first = renders.card;
    for (let run = 0; run < 10; run++)
      await act(async () => {
        await runtime.actions.execute('demo.work');
      });
    for (let change = 0; change < 5; change++) await act(async () => service.bump());
    assert.equal(runtime.actions.get('demo.work').title, 'Work 5', 'presentation was refreshed');
    assert.equal(renders.card, first, 'no outlet rendered its contribution again');
  } finally {
    await view.unmount();
  }
});

test('an action slot renders again for its own Actions only', async () => {
  const renders = { menu: 0 };
  function Menu() {
    renders.menu++;
    const view = useSlot('menu');
    return h(
      'nav',
      null,
      view.items.map((item) => h('span', { key: item.key }, item.action.title)),
    );
  }
  const config = {
    slots: { menu: defineSlot({ accepts: 'actions' }) },
    plugins: [
      definePlugin({
        id: 'demo',
        services: { counter },
        actions: {
          own: defineAction({
            title: ({ services }) => `Own ${services.demo.counter.state.get().n}`,
            slots: ['menu'],
            execute() {},
          }),
          other: defineAction({ title: 'Other', execute: async () => {} }),
        },
      }),
    ],
  };
  let runtime, service;
  function Capture() {
    runtime = useBitaKit().runtime;
    service = useService('demo.counter');
    return null;
  }
  const view = await mount(h(BitaKitRuntimeProvider, { config, ui: testUI }, h(Capture), h(Menu)));
  const text = () => view.container.querySelector('nav').textContent;
  try {
    await act(async () => {
      await runtime.ready;
    });
    assert.equal(text(), 'Own 0');
    const settled = renders.menu;
    for (let run = 0; run < 5; run++)
      await act(async () => {
        await runtime.actions.execute('demo.other');
      });
    assert.equal(renders.menu, settled, 'another Action running leaves the menu alone');
    await act(async () => service.bump());
    assert.equal(text(), 'Own 1', 'its own Action changing shows at once');
    assert.ok(renders.menu > settled);
  } finally {
    await view.unmount();
  }
});
