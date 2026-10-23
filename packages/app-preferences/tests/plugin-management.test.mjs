import { renderApp, controlledStorage, click, press, text, tick, deferred } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { definePlugin, defineService } from '@bitakit/core';
import { useBitaKit, pluginManagementAction } from '@bitakit/ui';
import { SettingsRoute } from '../dist/index.js';
import { appPreferencesPlugin } from '../dist/foundation.js';

async function fixture(plugins, search = '') {
  let runtime;
  function Page() {
    runtime = useBitaKit().runtime;
    return h(SettingsRoute, { pathname: '/settings/plugins' });
  }
  const view = await renderApp(h(Page), {
    config: { plugins: [appPreferencesPlugin(), ...plugins] },
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search,
  });
  return { ...view, runtime };
}
const button = (view, label) => view.container.querySelector(`button[aria-label="${label}"]`);
const answer = (view, label) =>
  click(
    [...view.container.querySelectorAll('[role=dialog] button')].find(
      (element) => text(element) === label,
    ),
  );
const source = (hooks = {}) =>
  definePlugin({
    id: 'source',
    metadata: { name: 'Source', tags: ['data'] },
    services: {
      data: defineService(({ onStart, onStop }) => {
        if (hooks.start) onStart(hooks.start);
        if (hooks.stop) onStop(hooks.stop);
        return {};
      }),
    },
  });
const consumer = definePlugin({
  id: 'consumer',
  metadata: { name: 'Consumer' },
  services: { data: defineService(() => ({}), { requires: ['source.data'] }) },
});

test('status filters compose with search and tags and update after confirmed plugin toggles', async () => {
  const view = await fixture(
    [source(), definePlugin({ id: 'other' })],
    '?pluginSearch=source&pluginTag=data&pluginStatus=enabled',
  );
  const names = () =>
    [...view.container.querySelectorAll('.app-preferences-plugin [data-slot=item-title]')].map(
      text,
    );
  const selectStatus = async (label) => {
    await press(button(view, 'Filter by status'), 'Enter');
    await click(
      [...document.querySelectorAll('[role=menuitemradio]')].find((e) => text(e) === label),
    );
  };
  try {
    assert.deepEqual(names(), ['Source']);
    await click(button(view, 'Disable Source'));
    await answer(view, 'Confirm');
    assert.deepEqual(names(), []);
    assert.equal(
      text(view.container.querySelector('[data-slot=empty-title]')),
      'No plugins found.',
    );
    assert.equal(
      text(view.container.querySelector('[data-slot=empty-description]')),
      'Try another search or change the filters.',
    );
    await selectStatus('Disabled');
    assert.deepEqual(names(), ['Source']);
    assert.match(view.urls.at(-1), /pluginStatus=disabled/);
    assert.match(view.urls.at(-1), /pluginSearch=source/);
    assert.match(view.urls.at(-1), /pluginTag=data/);
    await click(button(view, 'Enable Source'));
    assert.deepEqual(names(), []);
    await selectStatus('All plugins');
    assert.deepEqual(names(), ['Source']);
    assert.ok(!view.urls.at(-1).includes('pluginStatus'));
    assert.equal(view.runtime.isReady('source'), true);
  } finally {
    await view.unmount();
  }
});

test('management confirms dependencies, cancels safely, retains disabled rows and re-enables them', async () => {
  const view = await fixture([
    source(),
    consumer,
    definePlugin({
      id: 'provider',
      ui: { providers: [{ id: 'provider.root', component: ({ children }) => children }] },
    }),
  ]);
  try {
    assert.equal(button(view, 'Disable App Preferences').disabled, true);
    assert.equal(button(view, 'Disable provider').disabled, true);
    assert.match(
      view.container.querySelector(
        '#' + button(view, 'Disable provider').getAttribute('aria-describedby'),
      ).textContent,
      /restarting/,
    );
    await click(button(view, 'Disable Source'));
    assert.match(text(view.container.querySelector('[role=dialog]')), /also disables: Consumer/);
    await answer(view, 'Cancel');
    assert.equal(view.runtime.isReady('source'), true);
    await click(button(view, 'Disable Source'));
    await answer(view, 'Confirm');
    assert.equal(view.runtime.isReady('source'), false);
    assert.equal(view.runtime.isReady('consumer'), false);
    assert.ok(button(view, 'Enable Source'));
    assert.equal(button(view, 'Enable Consumer').disabled, true);
    assert.equal(view.container.querySelectorAll('.app-preferences-plugin').length, 4);
    assert.equal(view.container.querySelectorAll('[data-slot=item-separator]').length, 3);
    await click(button(view, 'Enable Source'));
    assert.equal(view.runtime.isReady('source'), true);
    await click(button(view, 'Enable Consumer'));
    assert.equal(view.runtime.isReady('consumer'), true);
    assert.equal(view.runtime.isReady('app-preferences'), true);
  } finally {
    await view.unmount();
  }
});

test('a pending disable excludes other changes; startup failure gives feedback and can be retried', async () => {
  const gate = deferred();
  let fail = false;
  const view = await fixture([
    source({
      stop: () => gate.promise,
      start: () => {
        if (fail) throw new Error('private startup cause');
      },
    }),
    definePlugin({ id: 'other' }),
  ]);
  try {
    await click(button(view, 'Disable Source'));
    await answer(view, 'Confirm');
    assert.equal(button(view, 'Disable Source').getAttribute('aria-busy'), 'true');
    assert.equal(button(view, 'Disable other').disabled, true);
    await act(async () => {
      gate.resolve();
      await tick();
    });
    fail = true;
    await click(button(view, 'Enable Source'));
    assert.match(text(view.container.querySelector('[role=alert]')), /Could not change Source/);
    assert.doesNotMatch(text(view.container), /private startup cause/);
    fail = false;
    await click(button(view, 'Enable Source'));
    assert.equal(view.runtime.isReady('source'), true);
    assert.equal(view.runtime.isReady('app-preferences'), true);
  } finally {
    gate.resolve();
    await view.unmount();
  }
});

test('failed cleanup prevents further changes and gives a recovery explanation', async () => {
  const view = await fixture([
    source({
      stop: () => {
        throw new Error('private cleanup cause');
      },
    }),
  ]);
  try {
    await click(button(view, 'Disable Source'));
    await answer(view, 'Confirm');
    assert.match(text(view.container.querySelector('[role=alert]')), /Could not change Source/);
    const toggle = button(view, 'Enable Source');
    assert.equal(toggle.disabled, true);
    assert.match(
      document.getElementById(toggle.getAttribute('aria-describedby')).textContent,
      /Cleanup failed/,
    );
    assert.doesNotMatch(text(view.container), /private cleanup cause/);
  } finally {
    await view.unmount();
  }
});

test('an accepted confirmation cannot apply after another composition revision', async () => {
  const view = await fixture([source(), definePlugin({ id: 'other' })]);
  try {
    await click(button(view, 'Disable Source'));
    await act(async () => {
      await view.runtime.plugins.disable('other', { dependents: 'refuse' });
    });
    await answer(view, 'Confirm');
    assert.equal(view.runtime.isReady('source'), true);
    assert.equal(view.runtime.actions.get(pluginManagementAction).pending, false);
  } finally {
    await view.unmount();
  }
});
