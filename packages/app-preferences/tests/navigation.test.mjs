import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  createTranslationPlugin,
  definePlugin,
  defineSettings,
  isFoundationStartupError,
  setting,
} from '@bitakit/core';
import appPreferencesPlugin from '../dist/foundation.js';

const Icon = () => null;
const todos = definePlugin({
  id: 'todos',
  metadata: { name: 'Todos', description: 'Task lists.', icon: Icon },
  settings: defineSettings(
    { pageSize: setting({ default: 20 }) },
    { title: 'Tasks', category: 'content', order: 5, icon: Icon, shortcut: 'Alt+Shift+T' },
  ),
});
const hiddenOnly = definePlugin({
  id: 'quiet',
  settings: defineSettings({ secret: setting({ default: 'x', hidden: true }) }),
});
const app = {
  settings: defineSettings({ compact: setting({ default: false }) }),
};
const ids = (runtime, prefix) =>
  Object.keys(runtime.actions.getState().actions)
    .filter((id) => id.startsWith(prefix))
    .sort();

test('setup projects sections, the settings entry and plugin results as URL Actions', () => {
  const runtime = createRuntime({
    ...app,
    plugins: [appPreferencesPlugin(), todos, hiddenOnly],
  });
  const stop = runtime.mount();
  try {
    const action = (id) => runtime.actions.resolve(id);
    assert.deepEqual(ids(runtime, 'settings.section.'), [
      'settings.section.app',
      'settings.section.app-preferences',
      'settings.section.todos',
    ]);
    const tasks = action('settings.section.todos');
    assert.equal(tasks.title, 'Tasks');
    assert.equal(tasks.href, '/settings/todos');
    assert.equal(tasks.icon, Icon);
    assert.equal(tasks.order, 5);
    assert.deepEqual(tasks.shortcut, { keys: 'Alt+Shift+T' }, 'the section shortcut opens it');
    assert.deepEqual(
      tasks.groups.map((group) => [group.id, group.title]),
      [
        ['settings.category.content', 'Content'],
        ['settings.pages', undefined],
      ],
      'the category heads the action; the pages group collects every section',
    );
    assert.deepEqual(runtime.destinationOf(tasks), { kind: 'settings', plugin: 'todos' });
    const general = action('settings.section.app');
    assert.equal(general.href, '/settings/general');
    assert.equal(general.groups[0].title, 'General');
    assert.deepEqual(runtime.destinationOf(general), { kind: 'settings' });
    assert.equal(general.shortcut, undefined);
    assert.equal(action('settings.section.app-preferences').href, '/settings/plugins');

    const entry = action('app-preferences.settings');
    assert.equal(entry.title, 'Settings');
    assert.equal(entry.href, '/settings');
    assert.deepEqual(
      entry.groups.map((group) => group.id),
      ['navigation'],
    );

    assert.deepEqual(ids(runtime, 'settings.plugins.'), [
      'settings.plugins.app-preferences',
      'settings.plugins.quiet',
      'settings.plugins.todos',
    ]);
    const plugin = action('settings.plugins.todos');
    assert.equal(plugin.title, 'Todos');
    assert.equal(plugin.description, 'Task lists.');
    assert.equal(plugin.href, '/settings/plugins?plugin=todos');
    assert.deepEqual(
      plugin.groups.map((group) => [group.id, group.title]),
      [
        ['settings.plugins.heading', 'Plugins'],
        ['settings.plugins', undefined],
      ],
    );
    assert.deepEqual(runtime.destinationOf(plugin), { kind: 'plugin', plugin: 'todos' });
    assert.ok(action('settings.plugins.quiet').icon, 'plugins without an icon get the default');
  } finally {
    stop();
  }
  assert.deepEqual(
    [...ids(runtime, 'settings.'), ...ids(runtime, 'app-preferences.')],
    [],
    'stopping removes every projected Action',
  );
});

test('the base path and entry groups are options; titles follow translation changes', () => {
  let messages = {
    'app-preferences.ui.settings': 'Einstellungen',
    'app-preferences.ui.plugins': 'Erweiterungen',
    'settings.categories.content.title': 'Inhalte',
    'todos.settings.title': 'Aufgaben',
    'plugins.todos.name': 'Aufgabenlisten',
  };
  const translator = () =>
    Object.assign((key) => messages[key] ?? key, { has: (key) => Object.hasOwn(messages, key) });
  const translation = createTranslationPlugin(translator());
  const runtime = createRuntime({
    ...app,
    plugins: [
      translation,
      appPreferencesPlugin({ basePath: '/preferences/', groups: ['account', 'navigation'] }),
      todos,
    ],
  });
  const stop = runtime.mount();
  try {
    const action = (id) => runtime.actions.resolve(id);
    assert.equal(action('settings.section.todos').href, '/preferences/todos');
    assert.equal(action('settings.section.todos').title, 'Aufgaben');
    assert.equal(action('settings.section.todos').groups[0].title, 'Inhalte');
    assert.equal(action('settings.plugins.todos').href, '/preferences/plugins?plugin=todos');
    assert.equal(action('settings.plugins.todos').title, 'Aufgabenlisten');
    assert.equal(action('settings.plugins.todos').groups[0].title, 'Erweiterungen');
    const entry = action('app-preferences.settings');
    assert.equal(entry.title, 'Einstellungen');
    assert.equal(entry.href, '/preferences');
    assert.deepEqual(entry.groups.map((group) => group.id).sort(), ['account', 'navigation']);

    messages = {
      'settings.categories.content.title': 'Content pages',
      'todos.settings.title': 'Task settings',
    };
    translation.update(translator());
    assert.equal(action('settings.section.todos').title, 'Task settings');
    assert.equal(
      action('settings.section.todos')
        .groups.map((group) => group.title)
        .join(),
      'Content pages,',
      'a new category title keeps the pages group',
    );
    assert.equal(action('settings.plugins.todos').title, 'Todos');
    assert.equal(action('app-preferences.settings').title, 'Settings');
  } finally {
    stop();
  }
  translation.update(translator());
  assert.equal(runtime.actions.resolve('settings.section.todos'), undefined);
});

test('an invalid base path is a startup error of App Preferences', () => {
  const runtime = createRuntime({ plugins: [appPreferencesPlugin({ basePath: 'settings' })] });
  assert.throws(
    () => runtime.mount(),
    (error) =>
      isFoundationStartupError(error) &&
      error.plugin === 'app-preferences' &&
      /must start with "\/"/.test(error.message),
  );
});
