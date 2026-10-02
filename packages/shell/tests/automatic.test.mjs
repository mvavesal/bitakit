import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { FoundationProvider } from '@bitakit/ui';
import { FoundationRuntime, createActionList, getService } from '@bitakit/core';
import { createAppPreferences } from '@bitakit/app-preferences/core';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import shellPlugin from '../dist/foundation.js';
import { AppShell, shellLayout, shellService, useShellLayout } from '../dist/index.js';

function Layout() {
  return h('span', null, useShellLayout());
}

test('Shell renders before mount with per-provider defaults and no explicit settings wiring', () => {
  const render = (layout) =>
    renderToString(
      h(
        FoundationProvider,
        {
          plugins: [appPreferencesPlugin(), shellPlugin({ layout })],
        },
        h(AppShell, null, h(Layout)),
      ),
    );
  assert.match(render('navbar'), /data-shell-layout="navbar"/);
  assert.match(render('sidebar'), /data-shell-layout="sidebar"/);
  assert.equal(shellLayout.defaultValue, 'sidebar');
});

test('Shell shares registered preferences; saved selection overrides the configured default', async () => {
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { value: 'sidebar', writable: true };
      },
      async save() {},
    },
  });
  const shell = shellPlugin({ layout: 'navbar' });
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [appPreferencesPlugin({ settings }), shell],
  });
  const stop = runtime.mount();
  try {
    assert.equal(getService(runtime.services, shellService).settings, settings);
    const layout = shell.contributions.settings[0];
    assert.equal(layout.key, 'shell.layout');
    assert.equal(layout.defaultValue, 'navbar');
    await settings.activate({ userId: 'saved-user' });
    assert.equal(settings.get(layout).value, 'sidebar');
  } finally {
    stop();
  }
});
