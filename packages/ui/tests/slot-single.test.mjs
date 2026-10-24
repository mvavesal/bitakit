import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act, useEffect } from 'react';
import { definePlugin, defineService, defineSlot } from '@bitakit/core';
import { BitaKitRuntimeProvider, PluginSlot, useBitaKit, useSlot } from '../dist/index.js';
import { installDom, mount, testUI, deferred } from './support.mjs';

installDom();

const screen = defineSlot({ accepts: 'component', policy: 'single' });
const named = (text) => () => h('p', null, text);

/** Renders `<PluginSlot name="screen">` with the given plugins, app contributions and choice. */
async function render({
  plugins = [],
  app = [],
  choose,
  fallback = h('p', null, 'default'),
  children,
}) {
  let runtime, diagnostics;
  function Capture() {
    runtime = useBitaKit().runtime;
    diagnostics = useSlot('screen').diagnostics;
    return null;
  }
  const config = { slots: { screen }, plugins, ui: { slots: app }, ...(choose ? { choose } : {}) };
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI },
      h(Capture),
      h(PluginSlot, { name: 'screen', fallback }, children),
    ),
  );
  await act(async () => {
    await runtime.ready;
  });
  return { view, text: () => view.container.textContent, diagnostics: () => diagnostics };
}
const plugin = (id, slots) => definePlugin({ id, ui: { slots } });

test('a single slot renders the fallback, the only candidate, or the app’s own contribution', async () => {
  const empty = await render({});
  assert.equal(empty.text(), 'default');
  assert.equal(empty.diagnostics().reason, 'empty');
  await empty.view.unmount();

  const one = await render({
    plugins: [plugin('brand', [{ slot: 'screen', component: named('brand') }])],
  });
  assert.equal(one.text(), 'brand');
  assert.deepEqual(one.diagnostics().candidates, ['brand']);
  await one.view.unmount();

  const app = await render({
    plugins: [plugin('brand', [{ slot: 'screen', component: named('brand') }])],
    app: [{ slot: 'screen', component: named('mine') }],
  });
  assert.equal(app.text(), 'mine');
  assert.deepEqual(
    app.diagnostics().excluded.map(({ plugin, reason }) => [plugin, reason]),
    [['brand', 'not-selected']],
  );
  await app.view.unmount();
});

test('several candidates render the fallback and report once; choose decides', async () => {
  const plugins = [
    plugin('brand', [{ slot: 'screen', component: named('brand') }]),
    plugin('fancy', [
      { slot: 'screen', component: named('split'), key: 'split' },
      { slot: 'screen', component: named('centered'), key: 'centered' },
    ]),
  ];
  const errors = [];
  const original = console.error;
  console.error = (message) => errors.push(String(message));
  try {
    const tie = await render({ plugins });
    assert.equal(tie.text(), 'default');
    assert.equal(tie.diagnostics().reason, 'ambiguous');
    assert.deepEqual(tie.diagnostics().candidates, ['brand', 'fancy:split', 'fancy:centered']);
    await tie.view.unmount();
    const again = await render({ plugins });
    await again.view.unmount();
    assert.equal(errors.length, 1, 'one report per slot');
    assert.match(
      errors[0],
      /Slot "screen" has several candidates \(brand, fancy:split, fancy:centered\)/,
    );
    assert.match(errors[0], /choose: \{ 'screen'/);

    const missing = await render({ plugins, choose: { screen: 'gone' } });
    assert.equal(missing.text(), 'default');
    assert.equal(missing.diagnostics().reason, 'choice-unavailable');
    await missing.view.unmount();
  } finally {
    console.error = original;
  }

  for (const [choice, expected] of [
    ['brand', 'brand'],
    ['centered', 'centered'],
    ['fancy:split', 'split'],
  ]) {
    const chosen = await render({ plugins, choose: { screen: choice } });
    assert.equal(chosen.text(), expected, choice);
    await chosen.view.unmount();
  }
});

test('children reach the occupant, and a failing occupant shows the fallback', async () => {
  const Frame = ({ children }) => h('main', null, 'frame:', children);
  const framed = await render({
    plugins: [plugin('brand', [{ slot: 'screen', component: Frame }])],
    children: h('span', null, 'page'),
  });
  assert.equal(framed.text(), 'frame:page');
  await framed.view.unmount();

  const Broken = () => {
    throw new Error('broken screen');
  };
  const original = console.error;
  console.error = () => {};
  try {
    const failing = await render({
      plugins: [plugin('brand', [{ slot: 'screen', component: Broken }])],
    });
    assert.equal(failing.text(), 'default');
    await failing.view.unmount();
  } finally {
    console.error = original;
  }
});

test('the selected file candidate renders before startup and is not remounted when ready', async () => {
  const gate = deferred();
  let mounts = 0;
  function Frame({ children }) {
    useEffect(() => {
      mounts++;
    }, []);
    return h('main', null, children);
  }
  const slow = definePlugin({
    id: 'slow',
    services: {
      wait: defineService(({ onStart }) => {
        onStart(() => gate.promise);
        return {};
      }),
    },
  });
  let runtime;
  function Capture() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: {
          slots: { screen },
          plugins: [slow, plugin('brand', [{ slot: 'screen', component: Frame }])],
        },
        ui: testUI,
      },
      h(Capture),
      h(PluginSlot, { name: 'screen', fallback: h('p', null, 'default') }, 'page'),
    ),
  );
  try {
    assert.equal(runtime.isReady(), false);
    assert.equal(
      view.container.textContent,
      'page',
      'the candidate, not the default, before startup',
    );
    await act(async () => {
      gate.resolve();
      await runtime.ready;
    });
    assert.equal(view.container.textContent, 'page');
    assert.equal(mounts, 1, 'the occupant stays mounted when the runtime takes over');
  } finally {
    await view.unmount();
  }
});

test('a payload slot renders its candidate only with the validated payload', async () => {
  const withPayload = defineSlot({
    accepts: 'component',
    policy: 'single',
    // An async schema: validation completes after the first render.
    payload: {
      '~standard': { version: 1, vendor: 'test', validate: async (value) => ({ value }) },
    },
  });
  const seen = [];
  function Screen({ payload }) {
    seen.push(payload);
    return h('p', null, `retry:${typeof payload.reset}`);
  }
  let runtime;
  function Capture() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const reset = () => {};
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: {
          slots: { screen: withPayload },
          plugins: [plugin('brand', [{ slot: 'screen', component: Screen }])],
        },
        ui: testUI,
      },
      h(Capture),
      h(PluginSlot, { name: 'screen', payload: { reset }, fallback: h('p', null, 'default') }),
    ),
  );
  try {
    await act(async () => {
      await runtime.ready;
    });
    assert.equal(view.container.textContent, 'retry:function');
    assert.ok(
      seen.every((payload) => payload && payload.reset === reset),
      'never an unchecked payload',
    );
  } finally {
    await view.unmount();
  }
});
