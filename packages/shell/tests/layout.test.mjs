import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FoundationRuntime, createActionList } from '@bitakit/core';
import { ActionProvider } from '@bitakit/ui/actions';
import { FoundationContext } from '../../ui/dist/providers/foundation-context.js';
import {
  createAppPreferences,
  createMemoryStorage,
  SettingsProvider,
} from '@bitakit/app-preferences';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import { AppShell, shellPlugin, shellLayout } from '../dist/index.js';

const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

test('fixed layout overrides preserve mounted content and omitted variants use defaults', async () => {
  const settings = createAppPreferences({ storage: createMemoryStorage() });
  const actions = createActionList();
  const runtime = new FoundationRuntime(actions, {
    plugins: [appPreferencesPlugin({ settings }), shellPlugin({ settings })],
  });
  const stop = runtime.mount();
  await settings.activate({ userId: 'layout-test' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let mounts = 0;
  function Content() {
    useEffect(() => {
      mounts++;
    }, []);
    return h('input', { 'aria-label': 'Unsaved document', defaultValue: 'Draft' });
  }
  const layouts = {
    sidebar: {
      Navigation: ({ brand }) => h('aside', { 'data-custom': 'sidebar' }, brand),
      Header: () => h('header', null, 'Custom header'),
    },
  };
  try {
    await act(async () =>
      root.render(
        h(
          ActionProvider,
          { actions },
          h(
            FoundationContext.Provider,
            { value: { runtime } },
            h(
              SettingsProvider,
              { settings, context: { userId: 'layout-test' } },
              h(AppShell, { layouts, brand: 'Brand', account: 'Account' }, h(Content)),
            ),
          ),
        ),
      ),
    );
    const input = container.querySelector('input');
    input.value = 'Unsaved edit';
    assert.ok(container.querySelector('[data-custom="sidebar"]'));
    await act(async () => {
      await settings.set(shellLayout, 'navbar');
    });
    assert.equal(container.querySelector('[data-custom="sidebar"]'), null);
    assert.match(container.textContent, /Account/);
    assert.equal(container.querySelector('input'), input);
    assert.equal(input.value, 'Unsaved edit');
    await act(async () => {
      await settings.set(shellLayout, 'sidebar');
    });
    assert.ok(container.querySelector('[data-custom="sidebar"]'));
    assert.equal(container.querySelector('input'), input);
    assert.equal(mounts, 1);
  } finally {
    await act(async () => root.unmount());
    stop();
    container.remove();
  }
});
