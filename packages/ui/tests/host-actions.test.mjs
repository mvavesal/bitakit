import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, StrictMode } from 'react';
import { installDom, mount, deferred, tick } from './support.mjs';
import { act } from 'react';
import { ActionProvider } from '../dist/actions/index.js';
import { createActionList, definePlugin, defineService } from '@bitakit/core';
import { BitaKitRuntimeProvider, useBitaKit } from '../dist/index.js';
import { testUI } from './support.mjs';

installDom();

/** Captures console.error calls while `run` executes. */
async function errorsDuring(run) {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    await run();
  } finally {
    console.error = original;
  }
  return errors;
}

test('Strict Mode binds the plugin management Action once the runtime is ready, without errors', async () => {
  const started = deferred();
  // A slow start keeps the runtime starting while Strict Mode unmounts and mounts again.
  const plugin = definePlugin({
    id: 'slow',
    services: {
      clock: defineService(({ onStart }) => {
        onStart(() => started.promise);
        return {};
      }),
    },
  });
  let runtime;
  function Probe() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const list = createActionList();
  let view;
  const errors = await errorsDuring(async () => {
    view = await mount(
      h(
        StrictMode,
        null,
        h(
          ActionProvider,
          { actions: list },
          h(BitaKitRuntimeProvider, { config: { plugins: [plugin] }, ui: testUI }, h(Probe)),
        ),
      ),
    );
    await act(async () => {
      started.resolve();
      await tick();
      await tick();
    });
  });
  try {
    assert.deepEqual(
      errors.filter((message) => message.includes('Host Actions')),
      [],
    );
    assert.equal(runtime.isReady(), true);
    assert.ok(list.get('runtime.plugins.change'), 'the management Action is bound');
  } finally {
    await view.unmount();
  }
});

test('Strict Mode binds the management Action when the runtime is ready synchronously', async () => {
  // No start hooks: the runtime becomes ready inside mount, before Strict Mode's second mount.
  const plugin = definePlugin({ id: 'instant', services: { value: defineService(() => ({})) } });
  let runtime;
  function Probe() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const list = createActionList();
  let view;
  const errors = await errorsDuring(async () => {
    view = await mount(
      h(
        StrictMode,
        null,
        h(
          ActionProvider,
          { actions: list },
          h(BitaKitRuntimeProvider, { config: { plugins: [plugin] }, ui: testUI }, h(Probe)),
        ),
      ),
    );
    await act(async () => {
      await tick();
      await tick();
    });
  });
  try {
    assert.deepEqual(
      errors.filter((message) => message.includes('Host Actions')),
      [],
    );
    assert.equal(runtime.isReady(), true);
    assert.ok(list.get('runtime.plugins.change'), 'the management Action is bound');
  } finally {
    await view.unmount();
  }
});
