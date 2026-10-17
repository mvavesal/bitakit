import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { defineAction, defineService, defineSlot } from '@bitakit/core';
import { BitaKitRuntimeProvider, Action, PluginSlot, useSlot, useBitaKit } from '../dist/index.js';
import { installDom, mount, click, tick, deferred } from './support.mjs';
installDom();

test('two outlets bind one Action independently, with live presentation and per-input pending', async () => {
  const gate = deferred(),
    calls = [];
  let runtime;
  const config = {
    slots: { members: defineSlot({ accepts: 'actions', payload: { parse: (value) => value } }) },
    services: { label: defineService(({ store }) => store('Remove')) },
    actions: {
      remove: defineAction({
        slots: [{ slot: 'members', input: ({ payload }) => payload.id }],
        title: ({ input, services }) => `${services.label.get()} ${input}`,
        enabled: ({ input }) => input !== 'locked',
        visible: ({ input }) => input !== 'hidden',
        concurrency: 'per-input',
        execute: async ({ input }) => {
          calls.push(input);
          await gate.promise;
        },
      }),
      groupOnly: defineAction({ title: 'Not placed', groups: ['members'], execute() {} }),
    },
  };
  function Outlet({ id }) {
    const slot = useSlot('members', { payload: { id } });
    runtime = useBitaKit().runtime;
    return h(
      'section',
      { 'data-id': id },
      slot.items.map((item) => h(Action, { key: item.key, id: item.action }, h('button'))),
    );
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config },
      ['ada', 'grace', 'locked', 'hidden'].map((id) => h(Outlet, { key: id, id })),
    ),
  );
  try {
    await act(tick);
    const buttons = () => [...view.container.querySelectorAll('button')];
    assert.deepEqual(
      buttons().map((x) => x.textContent),
      ['Remove ada', 'Remove grace', 'Remove locked'],
    );
    assert.equal(buttons()[2].disabled, true);
    await click(buttons()[1]);
    assert.deepEqual(calls, ['grace']);
    assert.equal(buttons()[0].disabled, false);
    assert.equal(buttons()[1].disabled, true);
    await act(() => runtime.services.label.set('Delete'));
    assert.equal(buttons()[0].textContent, 'Delete ada');
    gate.resolve();
    await act(tick);
    assert.equal(buttons()[1].disabled, false);
  } finally {
    gate.resolve();
    await view.unmount();
  }
});

test('outlet payload validation ignores stale completion and widgets receive the parsed payload', async () => {
  const first = deferred(),
    latest = deferred();
  const schema = {
    '~standard': {
      validate: async (input) => ({
        value: await (input.id === 'first' ? first.promise : latest.promise),
      }),
    },
  };
  const config = {
    slots: { footer: defineSlot({ accepts: 'component', payload: schema }) },
    ui: { slots: [{ slot: 'footer', component: ({ payload }) => h('b', null, payload.label) }] },
  };
  let state;
  function Probe({ id }) {
    state = useSlot('footer', { payload: { id } });
    return h(PluginSlot, { name: 'footer', payload: { id } });
  }
  const tree = (id) => h(BitaKitRuntimeProvider, { config }, h(Probe, { id }));
  const view = await mount(tree('first'));
  try {
    assert.equal(state.pending, true);
    await view.render(tree('latest'));
    await act(async () => {
      latest.resolve({ label: 'Current' });
      await tick();
    });
    assert.equal(view.container.textContent, 'Current');
    await act(async () => {
      first.resolve({ label: 'Stale' });
      await tick();
    });
    assert.equal(view.container.textContent, 'Current');
  } finally {
    await view.unmount();
  }
});

test('invalid payloads expose an outlet error without rendering stale contributions', async () => {
  const config = {
    slots: {
      panel: defineSlot({
        accepts: 'component',
        payload: {
          parse(value) {
            if (!value?.id) throw new Error('Member required');
            return value;
          },
        },
      }),
    },
    ui: { slots: [{ slot: 'panel', component: () => null }] },
  };
  let state;
  function Probe({ payload }) {
    state = useSlot('panel', { payload });
    return null;
  }
  const tree = (payload) => h(BitaKitRuntimeProvider, { config }, h(Probe, { payload }));
  const view = await mount(tree({ id: 'ada' }));
  try {
    await act(tick);
    assert.equal(state.items.length, 1);
    await view.render(tree({}));
    await act(tick);
    assert.match(state.error.message, /Member required/);
    assert.equal(state.items.length, 0);
    await view.render(tree({ id: 'grace' }));
    await act(tick);
    assert.equal(state.error, undefined);
    assert.equal(state.payload.id, 'grace');
    assert.equal(state.items.length, 1);
  } finally {
    await view.unmount();
  }
});

test('non-container payloads retain identity changes instead of comparing empty keys', async () => {
  let state;
  const config = {
    slots: {
      time: defineSlot({ accepts: 'component', payload: { parse: (value) => value.getTime() } }),
    },
  };
  function Probe({ payload }) {
    state = useSlot('time', { payload });
    return null;
  }
  const tree = (payload) => h(BitaKitRuntimeProvider, { config }, h(Probe, { payload }));
  const view = await mount(tree(new Date(10)));
  try {
    await act(tick);
    assert.equal(state.payload, 10);
    await view.render(tree(new Date(20)));
    await act(tick);
    assert.equal(state.payload, 20);
  } finally {
    await view.unmount();
  }
});

test('keyed body selection and per-outlet predicates never alter shared attachment membership', async () => {
  let runtime;
  const config = { slots: { body: defineSlot({ accepts: 'component', policy: 'keyed', payload: { parse: value => value } }) },
    ui: { slots: ['a', 'b'].map(key => ({ slot: 'body', key,
      when: ({ payload }) => payload.allowed,
      component: ({ payload }) => h('p', null, `${key}:${payload.page}`),
    })) } };
  function Probe() { runtime = useBitaKit().runtime; return null; }
  const view = await mount(h(BitaKitRuntimeProvider, { config }, h(Probe),
    h(PluginSlot, { name: 'body', entryKey: 'a', payload: { page: 'first', allowed: true } }),
    h(PluginSlot, { name: 'body', entryKey: 'b', payload: { page: 'second', allowed: false } }),
    h(PluginSlot, { name: 'body', entryKey: 'b', payload: { page: 'third', allowed: true } })));
  try {
    await act(tick);
    assert.deepEqual([...view.container.querySelectorAll('p')].map(x => x.textContent), ['a:first', 'b:third']);
    assert.equal(runtime.slots.get('body').items.length, 2);
  } finally { await view.unmount(); }
});
