import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { defineSlot, defineService } from '@bitakit/core';
import { BitaKitRuntimeProvider, PluginSlot, useBitaKit } from '../dist/index.js';
import { installDom, mount, deferred, tick } from './support.mjs';

installDom();

test('declared outlets follow readiness and attachments without owning their lifetime', async () => {
  const gate = deferred();
  let scope, runtime, attachment;
  const config = {
    slots: { toolbar: defineSlot({ accepts: 'component' }) },
    plugins: [
      {
        id: 'tools',
        services: {
          connection: defineService(({ onStart }) => {
            onStart(() => gate.promise);
            return {};
          }),
        },
        setup: ({ scope: app }) => {
          scope = app;
        },
        ui: { slots: [{ slot: 'toolbar', component: () => h('b', null, 'Declarative') }] },
      },
    ],
  };
  function Content({ visible }) {
    runtime = useBitaKit().runtime;
    return h(
      'main',
      null,
      h('input', { defaultValue: 'keep me' }),
      visible && h(PluginSlot, { name: 'toolbar' }),
    );
  }
  const tree = (visible) => h(BitaKitRuntimeProvider, { config }, h(Content, { visible }));
  const view = await mount(tree(true));
  try {
    assert.equal(view.container.querySelector('b'), null);
    await act(async () => {
      gate.resolve();
      await runtime.ready;
    });
    assert.equal(view.container.querySelector('b').textContent, 'Declarative');
    await act(async () => {
      attachment = scope.slots.attach({ slot: 'toolbar', component: () => h('i', null, 'Live') });
      await attachment.ready;
    });
    assert.equal(view.container.querySelector('i').textContent, 'Live');
    await view.render(tree(false));
    assert.equal(view.container.querySelector('i'), null);
    assert.equal(attachment.get().phase, 'attached');
    assert.equal(runtime.slots.get('toolbar').items.length, 2);
    await view.render(tree(true));
    assert.equal(view.container.querySelector('i').textContent, 'Live');
    await act(() => attachment.dispose());
    assert.equal(view.container.querySelector('i'), null);
    assert.equal(view.container.querySelector('input').value, 'keep me');
    await act(async () => {
      await runtime.stop();
    });
    assert.equal(view.container.querySelector('b'), null);
    assert.equal(runtime.slots.get('toolbar').items.length, 0);
  } finally {
    await view.unmount();
  }
});

test('replacing the composition removes old attachments and keeps legacy outlets working', async () => {
  let old;
  const config = { slots: { toolbar: defineSlot({ accepts: 'component' }) } };
  const plugins = [
    {
      id: 'tools',
      setup: ({ scope }) => {
        old = scope.slots.attach(
          { slot: 'toolbar', component: () => h('b', null, 'Live') },
          { availability: 'wait' },
        );
      },
      ui: { slots: [{ slot: 'legacy', component: () => h('i', null, 'Legacy') }] },
    },
  ];
  const tree = (current) =>
    h(
      BitaKitRuntimeProvider,
      { config, plugins: current },
      h(PluginSlot, { name: 'toolbar' }),
      h(PluginSlot, { name: 'legacy' }),
    );
  const view = await mount(tree(plugins));
  try {
    await act(tick);
    assert.equal(view.container.textContent, 'LiveLegacy');
    await view.render(tree([]));
    await act(tick);
    assert.equal(view.container.textContent, '');
    assert.equal(old.get().phase, 'detached');
  } finally {
    await view.unmount();
  }
});

test('an early ready owner does not render UI before existing service hooks are ready', async () => {
  const gate = deferred();
  let runtime;
  const config = {
    plugins: [
      {
        id: 'shell',
        slots: { toolbar: defineSlot({ accepts: 'component' }) },
        ui: { slots: [{ slot: 'shell.toolbar', component: () => h('b', null, 'Ready') }] },
      },
      {
        id: 'slow',
        services: {
          connection: defineService(({ onStart }) => {
            onStart(() => gate.promise);
            return {};
          }),
        },
      },
    ],
  };
  function Content() {
    runtime = useBitaKit().runtime;
    return h(PluginSlot, { name: 'shell.toolbar' });
  }
  const view = await mount(h(BitaKitRuntimeProvider, { config }, h(Content)));
  try {
    assert.equal(
      runtime.slots.get('shell.toolbar').items.length,
      1,
      'attachment readiness is per owner',
    );
    assert.equal(view.container.textContent, '', 'existing UI readiness remains runtime-wide');
    await act(async () => {
      gate.resolve();
      await runtime.ready;
    });
    assert.equal(view.container.textContent, 'Ready');
  } finally {
    gate.resolve();
    await view.unmount();
  }
});
