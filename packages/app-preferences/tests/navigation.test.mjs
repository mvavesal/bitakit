import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList, FoundationRuntime, PluginScope } from '@bitakit/core';
import { createAppPreferences, createMemoryStorage, SettingsSection } from '../dist/index.js';
import { bindSettingsNavigation } from '../dist/foundation/navigation.js';
import { appPreferencesPlugin } from '../dist/foundation/index.js';

test('settings pages name the plugin that contributed the section as their owner', () => {
  const runtime = new FoundationRuntime(createActionList(), {
    contributions: {
      'settings.sections': [new SettingsSection({ id: 'profile', title: 'Profile' })],
    },
    plugins: [
      appPreferencesPlugin({ settings: createAppPreferences({ storage: createMemoryStorage() }) }),
      {
        id: 'todos',
        contributions: {
          'settings.sections': [new SettingsSection({ id: 'alerts', title: 'Notifications' })],
        },
      },
    ],
  });
  const stop = runtime.mount();
  try {
    const of = (id) => runtime.destinationOf(runtime.actions.resolve(id));
    assert.deepEqual(of('settings.section.alerts'), { kind: 'settings', plugin: 'todos' });
    assert.deepEqual(of('settings.section.profile'), { kind: 'settings' });
  } finally {
    stop();
  }
});

test('catalog sections automatically register, update and remove URL Actions', () => {
  const settings = createAppPreferences({ storage: createMemoryStorage() });
  const list = createActionList();
  const scope = new PluginScope(list, new Map());
  const stop = bindSettingsNavigation(scope, settings);
  const section = settings.add(
    new SettingsSection({
      id: 'profile',
      title: 'Profile',
      category: { id: 'account', title: 'Account' },
    }),
  );
  assert.equal(list.resolve('settings.section.profile').href, '/settings/profile');
  assert.equal(list.resolve('settings.section.profile').groups[0].title, 'Account');
  settings.updateSection('profile', { title: 'Account profile', visible: false, enabled: false });
  assert.equal(list.resolve('settings.section.profile').title, 'Account profile');
  assert.equal(list.resolve('settings.section.profile').visible, false);
  assert.equal(list.resolve('settings.section.profile').enabled, false);
  const Icon = () => null;
  settings.updateSection('profile', {
    icon: Icon,
    navigation: { id: 'account.profile', shortcut: 'Alt+P' },
  });
  assert.equal(list.resolve('settings.section.profile'), undefined);
  assert.equal(list.resolve('account.profile').icon, Icon);
  assert.equal(list.resolve('account.profile').shortcut.keys, 'Alt+P');
  section.remove();
  assert.equal(list.resolve('account.profile'), undefined);
  assert.equal(list.resolve('settings.section.profile'), undefined);
  settings.add(new SettingsSection({ id: 'theme', title: 'Theme' }));
  stop();
  assert.equal(list.resolve('settings.section.theme'), undefined);
  settings.add(new SettingsSection({ id: 'locale', title: 'Language' }));
  assert.equal(list.resolve('settings.section.locale'), undefined);
  scope.dispose();
});

test('settings navigation retranslates catalog metadata and releases its subscription', async () => {
  const { createTranslationPlugin } = await import('@bitakit/core');
  const translation = createTranslationPlugin((key) =>
    key === 'settings.sections.profile.title' ? 'Profil' : key,
  );
  const settings = createAppPreferences({ storage: createMemoryStorage() });
  settings.add(new SettingsSection({ id: 'profile', title: 'Profile' }));
  const list = createActionList();
  const scope = new PluginScope(list, new Map());
  const stop = bindSettingsNavigation(scope, settings, translation.translation);
  assert.equal(list.resolve('settings.section.profile').title, 'Profil');
  translation.update((key) =>
    key === 'settings.sections.profile.title' ? 'Account profile' : key,
  );
  assert.equal(list.resolve('settings.section.profile').title, 'Account profile');
  stop();
  translation.update((key) => key);
  assert.equal(list.resolve('settings.section.profile'), undefined);
  scope.dispose();
});
