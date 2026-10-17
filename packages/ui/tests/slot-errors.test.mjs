import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement as h, Suspense, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { defineAction, definePlugin, defineSlot } from '@bitakit/core';
import {
  Action,
  BitaKitRuntimeProvider,
  PluginSlot,
  SlotErrorBoundary,
  useBitaKit,
} from '../dist/index.js';
import { installDom, mount, click, tick, silenced, testUI } from './support.mjs';
installDom();

const slotName = 'test.render-errors';

test('PluginSlot contains component crashes, preserves siblings, reports attribution, and retries explicitly', async () => {
  const reported = [];
  let actionCalls = 0;
  let attempts = 0;
  const cause = new Error('private render detail');
  function Crashing() {
    attempts++;
    throw cause;
  }
  const owner = definePlugin({
    id: 'crasher',
    actions: {
      activate: defineAction({
        title: 'Action works',
        execute: () => {
          actionCalls++;
        },
      }),
    },
    ui: { slots: [{ slot: slotName, component: Crashing }] },
  });
  function HealthySibling() {
    const [value, setValue] = useState(0);
    return h('button', { onClick: () => setValue(value + 1) }, `Healthy ${value}`);
  }
  const config = {
    slots: {
      [slotName]: defineSlot({ accepts: 'component', payload: { parse: (value) => value } }),
    },
    plugins: [owner],
  };
  const view = await silenced(() =>
    mount(
      h(
        BitaKitRuntimeProvider,
        {
          config,
          ui: testUI,
          actionOptions: {
            onError: (error) => {
              reported.push(error);
              throw new Error('reporter failed');
            },
          },
        },
        h(
          'main',
          null,
          h(PluginSlot, { name: slotName, payload: {} }),
          h(HealthySibling),
          h(Action, { id: 'crasher.activate' }, h('button', null, 'Run action')),
          h('a', { href: '/still-here' }, 'Navigation'),
        ),
      ),
    ),
  );
  const mounted = view.value;
  try {
    await act(tick);
    assert.match(mounted.container.textContent, /Try again/);
    assert.match(mounted.container.textContent, /Healthy 0/);
    assert.ok(mounted.container.querySelector('a[href="/still-here"]'));
    const alert = mounted.container.querySelector('[role="alert"]');
    assert.ok(alert);
    assert.doesNotMatch(alert.textContent, /private render detail/);
    assert.equal(reported.length, 1);
    assert.equal(reported[0].slot, slotName);
    assert.equal(reported[0].plugin, 'crasher');
    assert.equal(typeof reported[0].contribution, 'string');
    assert.equal(reported[0].cause, cause);

    await click(
      [...mounted.container.querySelectorAll('button')].find((button) =>
        button.textContent.startsWith('Healthy'),
      ),
    );
    assert.match(mounted.container.textContent, /Healthy 1/);
    await click(
      [...mounted.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Run action',
      ),
    );
    assert.equal(actionCalls, 1, 'actions outside the failed contribution remain usable');
    const beforeRetry = attempts;
    const retries = mounted.container.querySelector('[role="alert"] button');
    const retryLogs = await silenced(() => click(retries));
    assert.ok(retryLogs.errors.some((message) => message.includes('private render detail')));
    assert.equal(
      retryLogs.errors.some((message) => message.includes('not wrapped in act')),
      false,
    );
    assert.ok(attempts > beforeRetry, 'retry tries the failed contribution again');
    assert.equal(mounted.container.querySelectorAll('[role="alert"]').length, 1);
    assert.match(mounted.container.textContent, /Healthy 1/);
  } finally {
    await mounted.unmount();
  }
  assert.equal(
    mounted.container.innerHTML,
    '',
    'unmount removes failed and healthy outlet content',
  );
  assert.ok(view.errors.length > 0, 'React reports the expected render exceptions');
});

test('failed outlet entries survive ordinary rerenders and unrelated reconciliation, then reset for their new owner', async () => {
  let runtime;
  let attempts = 0;
  const badContribution = () => {
    attempts++;
    throw new Error('broken contribution');
  };
  const owner = definePlugin({
    id: 'owner',
    ui: { slots: [{ slot: slotName, component: badContribution }] },
  });
  const unrelated = definePlugin({
    id: 'unrelated',
    actions: {
      ping: defineAction({ title: 'Before', execute() {} }),
    },
  });
  const config = {
    slots: {
      [slotName]: defineSlot({ accepts: 'component', payload: { parse: (value) => value } }),
    },
    plugins: [owner, unrelated],
  };
  function CaptureRuntime() {
    runtime = useBitaKit().runtime;
    return null;
  }
  const tree = () =>
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI },
      h(CaptureRuntime),
      h(PluginSlot, { name: slotName, payload: { value: 1 } }),
    );
  const view = await silenced(() => mount(tree()));
  try {
    await act(tick);
    const failedRenders = attempts;
    assert.ok(failedRenders > 0);
    await view.value.render(tree());
    assert.equal(attempts, failedRenders, 'same owner and contribution do not retry on rerender');

    const updatedUnrelated = definePlugin({
      id: 'unrelated',
      actions: {
        ping: defineAction({ title: 'After', execute() {} }),
      },
    });
    let update;
    await act(async () => {
      update = await runtime.reconcilePlugins([owner, updatedUnrelated]);
    });
    assert.equal(update.status, 'applied');
    assert.equal(
      attempts,
      failedRenders,
      'reconciling an unrelated plugin leaves the failed entry isolated',
    );

    const recovered = definePlugin({
      id: 'owner',
      ui: {
        slots: [
          {
            slot: slotName,
            component: () => h('p', { 'data-recovered': true }, 'Recovered owner'),
          },
        ],
      },
    });
    await act(async () => {
      update = await runtime.reconcilePlugins([recovered, updatedUnrelated]);
    });
    assert.equal(update.status, 'applied');
    assert.equal(
      view.value.container.querySelector('[data-recovered]')?.textContent,
      'Recovered owner',
    );
    assert.equal(
      runtime.slots.get(slotName).items.length,
      1,
      'recovery does not duplicate the slot entry',
    );
  } finally {
    await view.value.unmount();
  }
});

test('SlotErrorBoundary supports custom fallback metadata and independent outlets', async () => {
  const failure = new Error('internal cause');
  const Bad = () => {
    throw failure;
  };
  const captured = {};
  const boundary = (id) =>
    h(
      SlotErrorBoundary,
      {
        slot: slotName,
        plugin: `plugin-${id}`,
        contribution: `entry-${id}`,
        errorFallback: ({ error, retry }) => {
          captured[id] = error;
          return h('button', { 'data-retry': id, onClick: retry }, `Retry ${id}`);
        },
      },
      h(Bad),
    );
  const view = await silenced(() =>
    mount(
      h(
        BitaKitRuntimeProvider,
        { ui: testUI },
        h(
          'div',
          null,
          h('section', { key: 'a' }, boundary('a')),
          h('section', { key: 'b' }, boundary('b')),
        ),
      ),
    ),
  );
  try {
    await act(tick);
    assert.equal(view.value.container.querySelectorAll('[data-retry]').length, 2);
    assert.equal(captured.a.slot, slotName);
    assert.equal(captured.a.plugin, 'plugin-a');
    assert.equal(captured.a.contribution, 'entry-a');
    assert.equal(captured.a.cause, failure);
    assert.equal(captured.b.plugin, 'plugin-b');
    const retryLogs = await silenced(() =>
      click(view.value.container.querySelector('[data-retry="a"]')),
    );
    assert.equal(
      retryLogs.errors.some((message) => message.includes('not wrapped in act')),
      false,
    );
    assert.equal(
      view.value.container.querySelectorAll('[data-retry]').length,
      2,
      'retrying one outlet leaves the other outlet failed independently',
    );
  } finally {
    await view.value.unmount();
  }
});

test('a pending PluginSlot contribution remains available to the surrounding Suspense boundary', async () => {
  let resolve;
  let ready = false;
  const promise = new Promise((done) => {
    resolve = done;
  });
  function Pending() {
    if (!ready) throw promise;
    return h('p', null, 'Loaded');
  }
  const plugin = definePlugin({
    id: 'pending',
    ui: { slots: [{ slot: slotName, component: Pending }] },
  });
  const config = {
    slots: {
      [slotName]: defineSlot({ accepts: 'component', payload: { parse: (value) => value } }),
    },
    plugins: [plugin],
  };
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, ui: testUI },
      h(
        Suspense,
        { fallback: h('p', null, 'Waiting') },
        h(PluginSlot, { name: slotName, payload: {} }),
      ),
    ),
  );
  try {
    assert.match(view.container.textContent, /Waiting/);
    ready = true;
    await act(async () => {
      ready = true;
      resolve();
      await promise;
      await tick();
    });
    assert.match(view.container.textContent, /Loaded/);
  } finally {
    await view.unmount();
  }
});

test('PluginSlot payload validation errors propagate to the host error boundary', async () => {
  const config = {
    slots: {
      [slotName]: defineSlot({
        accepts: 'component',
        payload: {
          parse() {
            throw new Error('invalid outlet payload');
          },
        },
      }),
    },
    ui: { slots: [{ slot: slotName, component: () => h('p', null, 'Should not render') }] },
  };
  const mounted = await silenced(() =>
    mount(
      h(
        BitaKitRuntimeProvider,
        { config, ui: testUI },
        h(
          ErrorBoundary,
          {
            fallbackRender: ({ error }) => h('p', { 'data-host-error': true }, error.message),
          },
          h(PluginSlot, { name: slotName, payload: {} }),
        ),
      ),
    ),
  );
  const view = mounted.value;
  try {
    const validationLogs = await silenced(() => act(tick));
    const loggedErrors = [...mounted.errors, ...validationLogs.errors].join('\n');
    assert.ok(loggedErrors.includes('invalid outlet payload'));
    assert.equal(loggedErrors.includes('not wrapped in act'), false);
    assert.equal(
      view.container.querySelector('[data-host-error]')?.textContent,
      'invalid outlet payload',
    );
    assert.equal(
      view.container.textContent.includes('Try again'),
      false,
      'payload binding errors do not become contribution render fallbacks',
    );
  } finally {
    await view.unmount();
  }
});
