import test from 'node:test';
import assert from 'node:assert/strict';
import { FoundationRuntime, createActionList } from '@bitakit/core';
import {
  createAppPreferences,
  SettingsSection,
  SelectSetting,
  projectSettings,
} from '@bitakit/app-preferences/core';
import {
  appPreferencesPlugin,
  createInitialSettingsSnapshot,
} from '@bitakit/app-preferences/foundation';
import { shellPlugin, shellTheme, shellLayout, ThemeCards, LayoutCards } from '../dist/index.js';

const storage = {
  async load() {
    return { writable: true };
  },
  async save() {},
};
const runtime = (settings, shell, plugins = []) =>
  new FoundationRuntime(createActionList(), {
    plugins: [appPreferencesPlugin({ settings }), shellPlugin({ settings, ...shell }), ...plugins],
  });

test('Shell contributes owned preferences and its page; cleanup cancels late responses', async () => {
  let finish;
  const settings = createAppPreferences({
    storage: {
      ...storage,
      async save() {
        await new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  const category = { id: 'account', title: 'My Account' };
  const stop = runtime(settings, { appearance: true, category }).mount();
  const other = settings.add(
    new SettingsSection({
      id: 'other',
      pluginId: 'other-plugin',
      title: 'Other',
      category,
      component: () => null,
    }),
  );
  await settings.activate({ userId: 'alex' });
  assert.deepEqual(settings.ownersOf(shellLayout), ['shell']);
  assert.deepEqual(
    settings.getSection('appearance').fields.map((field) => field.key),
    ['shell.theme', 'shell.layout'],
  );
  const saving = settings.set(shellLayout, 'navbar');
  assert.equal(settings.get(shellLayout).pending, true);
  assert.equal(settings.get(shellLayout).value, 'sidebar');
  assert.equal(settings.getSection('appearance').pluginId, 'shell');
  stop();
  finish();
  assert.equal(await saving, 'cancelled');
  assert.throws(() => settings.get(shellLayout), /Unregistered/);
  assert.deepEqual(
    projectSettings(settings.getSections()).flatMap((group) =>
      group.entries.map((entry) => entry.action.id),
    ),
    ['other'],
  );
  other.remove();
  assert.equal(settings.getSections().length, 0);
});

test('the initial snapshot resolves the Shell card renderers before mount', () => {
  const settings = createAppPreferences({ storage });
  const initial = createInitialSettingsSnapshot(runtime(settings, { appearance: true }));
  assert.equal(
    initial.renderers.resolveField(shellTheme, initial.state.owners('shell.theme')).component,
    ThemeCards,
  );
  assert.equal(
    initial.renderers.resolveField(shellLayout, initial.state.owners('shell.layout')).component,
    LayoutCards,
  );
  assert.deepEqual(
    initial.state.sections.map((section) => [section.id, section.pluginId]),
    [['shell-theme', 'shell'], ['appearance', 'shell']],
  );
  assert.equal(settings.getSections().length, 0, 'the snapshot is pure');
});

test('a host can supply its existing theme definition without registering or renaming shell.theme', async () => {
  const theme = new SelectSetting({
    key: 'appearance.theme',
    title: 'Theme',
    defaultValue: 'dark',
    options: shellTheme.options,
  });
  const settings = createAppPreferences({ storage, definitions: [theme] });
  const stop = runtime(settings, {
    appearance: true,
    theme,
    applyTheme: false,
    category: { id: 'personal', title: 'Personal' },
  }).mount();
  await settings.activate({});
  assert.equal(settings.get(theme).value, 'dark');
  assert.deepEqual(settings.ownersOf(theme), ['shell'], 'Shell co-owns the host definition');
  assert.throws(() => settings.get(shellTheme), /Unregistered/);
  stop();
  assert.equal(settings.get(theme).value, 'dark');
});

test('removing Shell never removes a shared host parent or another plugin page', () => {
  const settings = createAppPreferences({ storage });
  settings.add(new SettingsSection({ id: 'plugins', title: 'Plugins' }));
  settings.add(new SettingsSection({ id: 'other', title: 'Other', component: () => null }), {
    section: 'plugins',
  });
  const stop = runtime(settings, { settingsSection: 'plugins' }).mount();
  assert.equal(settings.getSection('shell').pluginId, 'shell');
  stop();
  assert.deepEqual(
    settings.getSections().map((section) => section.id),
    ['plugins', 'other'],
  );
});

test('Shell without the Settings integration fails with an actionable error', () => {
  const settings = createAppPreferences({ storage });
  const bare = new FoundationRuntime(createActionList(), { plugins: [shellPlugin({ settings })] });
  assert.throws(
    () => bare.mount(),
    /"shell" contributes "settings", but no enabled plugin installs that kind/,
  );
});

test('Settings navigation includes field-only Shell pages from the shared catalog', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SettingsProvider } = await import('@bitakit/app-preferences');
  const { SettingsNavigation } = await import('../dist/settings/shell.js');
  const settings = createAppPreferences({ storage });
  const stop = runtime(settings, { appearance: true }).mount();
  try {
    const html = renderToStaticMarkup(
      createElement(SettingsProvider, { settings },
        createElement(SettingsNavigation, { pathname: '/settings/theme' })),
    );
    assert.match(html, /href="\/settings\/theme"/);
    assert.match(html, /href="\/settings\/appearance"/);
    assert.match(html, /Darstellung/);
  } finally {
    stop();
  }
});
