import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act, Suspense, useLayoutEffect } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  createAppPreferences,
  SettingsSection,
  SettingsGroup,
  SelectSetting,
  ToggleSetting,
  SettingsProvider,
  SettingsPanel,
  SettingSelect,
  useSetting,
  useSettingsSections,
} from '../dist/index.js';
const dom = new JSDOM('<html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('late Suspense hydration matches the initial catalog before adopting plugin registrations', async () => {
  const makeSettings = () => {
    const settings = createAppPreferences({
      storage: {
        async load() {
          return { writable: true };
        },
        async save() {},
      },
    });
    settings.add(new SettingsSection({ id: 'appearance', title: 'Appearance' }));
    return settings;
  };
  function Register({ settings }) {
    useLayoutEffect(
      () => settings.add(new SettingsSection({ id: 'plugin', title: 'Plugin' })).remove,
      [settings],
    );
    return null;
  }
  function Navigation() {
    return h(
      'nav',
      null,
      useSettingsSections().map((section) => h('span', { key: section.id }, section.title)),
    );
  }
  const view = (settings) =>
    h(
      SettingsProvider,
      { settings },
      h(Register, { settings }),
      h(Suspense, { fallback: null }, h(Navigation)),
    );
  const host = document.createElement('div');
  host.innerHTML = renderToString(view(makeSettings()));
  document.body.append(host);
  const errors = [];
  let root;
  await act(async () => {
    root = hydrateRoot(host, view(makeSettings()), {
      onRecoverableError: (error) => errors.push(error.message),
    });
  });
  try {
    assert.deepEqual(errors, []);
    assert.equal(host.querySelector('nav').textContent, 'AppearancePlugin');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('standalone custom section and controls reflect direct writes, pending and failures without Actions', async () => {
  const theme = new SelectSetting({
    key: 'ui.theme',
    title: 'Theme',
    defaultValue: 'light',
    options: ['light', 'dark'].map((value) => ({ value, label: value })),
  });
  const enabled = new ToggleSetting({ key: 'ui.enabled', title: 'Enabled', defaultValue: false });
  let finish;
  let failure = false;
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save() {
        if (failure) throw new Error('offline');
        await new Promise((resolve) => (finish = resolve));
      },
    },
  });
  function Cards({ value, onValueChange, disabled }) {
    return h(
      'button',
      { disabled, 'aria-pressed': value === 'dark', onClick: () => onValueChange('dark') },
      'Dark card',
    );
  }
  function CustomSection() {
    const state = useSetting(theme);
    return h(
      'div',
      null,
      h('output', null, state.value),
      h(SettingSelect, { setting: theme, as: Cards }),
    );
  }
  settings.add(
    new SettingsSection({
      id: 'appearance',
      title: 'Appearance',
      component: CustomSection,
      groups: [new SettingsGroup({ title: 'Theme', items: [theme] })],
    }),
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(h(SettingsProvider, { settings }, h(SettingsPanel))));
  try {
    assert.equal(host.querySelector('output').textContent, 'light');
    await act(async () => host.querySelector('button').click());
    assert.equal(host.querySelector('button').disabled, true);
    await act(async () => finish());
    assert.equal(host.querySelector('output').textContent, 'dark');
    assert.equal(host.querySelector('button').getAttribute('aria-pressed'), 'true');
    failure = true;
    await act(async () => {
      await settings.set(theme, 'light').catch(() => {});
    });
    assert.equal(host.querySelector('output').textContent, 'dark');
    assert.equal(host.querySelector('[role=alert]').textContent, 'offline');
    let reg;
    await act(async () => {
      reg = settings.add(
        new SettingsSection({
          id: 'plugin',
          title: 'Plugin',
          groups: [new SettingsGroup({ title: 'Options', items: [enabled] })],
        }),
      );
    });
    assert.ok(host.querySelector('input[type=checkbox]'));
    await act(async () => reg.remove());
    assert.equal(host.querySelector('input[type=checkbox]'), null);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
