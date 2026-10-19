import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { renderToString } from 'react-dom/server';
import { installDom, mount, tick, deferred, silenced, testUI } from './support.mjs';
import { BitaKitRuntimeProvider } from '../dist/index.js';
import { definePlugin, defineService } from '@bitakit/core';

installDom();

const state = () => document.documentElement.getAttribute('data-bitakit-runtime');

/** A plugin whose onStart settles when the test decides. */
function startsLater(id) {
  const start = deferred();
  const plugin = definePlugin({
    id,
    services: {
      sync: defineService(({ onStart }) => {
        onStart(() => start.promise);
        return {};
      }),
    },
  });
  const settle = (error) =>
    act(async () => {
      if (error) start.reject(error);
      else start.resolve();
      await tick();
    });
  return { plugin, settle };
}
const tree = (props) => h(BitaKitRuntimeProvider, { ui: testUI, ...props }, h('main'));

test('<html data-bitakit-runtime> follows startup after hydration and is removed on unmount', async () => {
  const slow = startsLater('slow');
  // Server and hydration markup never carry the attribute; it is written by an effect.
  assert.doesNotMatch(renderToString(tree({ plugins: [slow.plugin] })), /data-bitakit-runtime/);
  assert.equal(state(), null);
  const view = await mount(tree({ plugins: [slow.plugin] }));
  try {
    assert.equal(state(), 'starting');
    await slow.settle();
    assert.equal(state(), 'ready');
  } finally {
    await view.unmount();
  }
  assert.equal(state(), null);
});

test('an isolated plugin failure still reaches ready; an app failure reports failed', async () => {
  const slow = startsLater('slow');
  const view = await render({ isolateFailures: true, plugins: [slow.plugin] });
  try {
    await silenced(() => slow.settle(new Error('sync failed')));
    assert.equal(state(), 'ready', 'the rest of the app keeps running');
  } finally {
    await view.unmount();
  }
  const boot = startsLater('boot');
  const fatal = await render({
    isolateFailures: true,
    config: { services: boot.plugin.services },
  });
  try {
    await silenced(() => boot.settle(new Error('boot failed')));
    assert.equal(state(), 'failed');
  } finally {
    await fatal.unmount();
    document.documentElement.removeAttribute('data-bitakit-runtime');
  }
});

test('a fail-fast startup error leaves failed on the document after the tree is torn down', async () => {
  const slow = startsLater('slow');
  const view = await render({ isolateFailures: false, plugins: [slow.plugin] });
  try {
    assert.equal(state(), 'starting');
    await assert.rejects(
      () => silenced(() => slow.settle(new Error('sync failed'))),
      /onStart in plugin "slow" failed: sync failed/,
    );
    assert.equal(view.container.querySelector('main'), null, 'the provider tree is gone');
    assert.equal(state(), 'failed');
  } finally {
    await view.unmount();
    document.documentElement.removeAttribute('data-bitakit-runtime');
  }
});

async function render(props) {
  const { value } = await silenced(() => mount(tree(props)));
  return value;
}
