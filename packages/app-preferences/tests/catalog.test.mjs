import { renderApp } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import {
  createMemorySettingsStorage,
  definePlugin,
  defineSettings,
  setting,
  useFoundation,
  useSettingsCatalog,
} from '@bitakit/ui';
import { appPreferencesPlugin } from '../dist/foundation.js';
import { settingsCategories } from '../dist/index.js';
import { settingsCatalog } from '../dist/catalog.js';
import { groupByCategory } from '../dist/categories.js';
import { searchSettings } from '../dist/search.js';

const Page = () => h('p', null, 'custom page');
const todos = definePlugin({
  id: 'todos',
  metadata: { name: 'Todos' },
  settings: defineSettings(
    {
      pageSize: setting({ default: 20, label: 'Page size', order: 2 }),
      sort: setting({
        default: 'due',
        label: 'Sort by',
        order: 1,
        options: [{ value: 'due', label: 'Due date' }, { value: 'title' }],
      }),
      internal: setting({ default: true, hidden: true }),
    },
    { category: 'content', order: 5, description: 'Lists and sorting.' },
  ),
});
const notes = definePlugin({ id: 'notes', ui: { settings: { component: Page } } });
const quiet = definePlugin({
  id: 'quiet',
  settings: defineSettings({ secret: setting({ default: 'x', hidden: true }) }),
});
const config = {
  settings: defineSettings({
    theme: setting({ default: 'system', options: [{ value: 'light' }, { value: 'system' }] }),
  }),
  plugins: [appPreferencesPlugin(), todos, notes, quiet],
};
const messages = {
  'todos.settings.title': 'Aufgaben',
  'todos.settings.pageSize.label': 'Seitengröße',
  'todos.settings.sort.options.title.label': 'Titel',
  'app.settings.theme.options.light.label': 'Hell',
  'app-preferences.settings.description': 'Installierte Erweiterungen.',
};
const translate = Object.assign((key) => messages[key] ?? key, {
  has: (key) => Object.hasOwn(messages, key),
});

test('settingsCatalog builds the same sections as useSettingsCatalog, including translations', async () => {
  let seen;
  let runtime;
  function Probe() {
    seen = useSettingsCatalog();
    runtime = useFoundation().runtime;
    return null;
  }
  const view = await renderApp(h(Probe), {
    config,
    translate,
    storage: createMemorySettingsStorage(),
  });
  try {
    const own = settingsCatalog(runtime.modules, 'app', translate);
    assert.deepEqual(own, seen, 'the setup catalog and the hook agree');
    assert.deepEqual(
      own.map((section) => [section.id, section.path, section.category, section.title]),
      [
        ['app', 'general', 'general', 'General'],
        ['notes', 'notes', 'plugins', 'Notes'],
        ['quiet', 'quiet', 'plugins', 'Quiet'],
        ['todos', 'todos', 'content', 'Aufgaben'],
        ['app-preferences', 'plugins', 'plugins', 'Plugins'],
      ],
    );
    const todosSection = own.find((section) => section.id === 'todos');
    assert.deepEqual(
      todosSection.fields.map((field) => [field.key, field.label]),
      [
        ['todos.sort', 'Sort by'],
        ['todos.pageSize', 'Seitengröße'],
      ],
      'fields follow their order; hidden settings stay out',
    );
    assert.deepEqual(
      todosSection.fields[0].options.map((option) => option.label),
      ['Due date', 'Titel'],
    );
    assert.equal(own[0].fields[0].options[0].label, 'Hell', 'the app uses the `app` prefix');
    assert.equal(
      own.find((section) => section.id === 'app-preferences').description,
      'Installierte Erweiterungen.',
    );
    assert.equal(
      settingsCatalog(runtime.modules, 'app').find((section) => section.id === 'todos').title,
      'Todos',
      'without a translator the declaration and the metadata apply',
    );
  } finally {
    await view.unmount();
  }
});

test('categories keep their declared order; unknown ones follow by title', () => {
  assert.deepEqual(
    settingsCategories.map((category) => category.id),
    ['general', 'appearance', 'account', 'organization', 'plugins', 'administration'],
  );
  const items = ['zeta', 'plugins', 'alpha', 'general', 'account', 'appearance'].map((id) => ({
    id,
  }));
  const groups = groupByCategory(
    items,
    (item) => item.id,
    (id) => id.toUpperCase(),
  );
  assert.deepEqual(
    groups.map((group) => group.id),
    ['general', 'appearance', 'account', 'plugins', 'alpha', 'zeta'],
  );
});

test('search matches section text, field text and words split across both', () => {
  const sections = settingsCatalog(
    [{ id: 'app' }, todos, notes].map((module) => ({ ...module })),
    'app',
  );
  const ids = (query) =>
    searchSettings(sections, query).map(({ section, fields }) => [
      section.id,
      fields.map((field) => field.name),
    ]);
  assert.deepEqual(ids(''), [
    ['notes', []],
    ['todos', ['sort', 'pageSize']],
  ]);
  assert.deepEqual(ids('lists'), [['todos', ['sort', 'pageSize']]], 'a section match keeps all');
  assert.deepEqual(ids('PAGE'), [['todos', ['pageSize']]], 'field labels match');
  assert.deepEqual(ids('todos due'), [['todos', ['sort']]], 'option labels match with the section');
  assert.deepEqual(ids('nothing here'), []);
});

test('additional settings pages share the catalog and retain ownership without duplicating fields', async () => {
  const multi = definePlugin({
    id: 'workspace',
    settings: defineSettings({ label: setting({ default: 'Name' }) }, { category: 'organization' }),
    ui: {
      settings: {
        component: Page,
        pages: [
          { id: 'members', title: 'Members', component: Page, shortcut: 'Alt+M' },
          {
            id: 'invites',
            title: 'My invitations',
            path: 'account/invitations',
            category: 'account',
            component: Page,
          },
        ],
      },
    },
  });
  let catalog, runtime;
  function Probe() {
    catalog = useSettingsCatalog();
    runtime = useFoundation().runtime;
    return null;
  }
  const view = await renderApp(h(Probe), { config: { plugins: [appPreferencesPlugin(), multi] } });
  try {
    assert.deepEqual(catalog, settingsCatalog(runtime.modules, 'app'));
    const pages = catalog.filter((entry) => entry.plugin === 'workspace');
    assert.equal(pages.length, 3);
    assert.equal(pages.filter((entry) => entry.fields.length).length, 1);
    const members = runtime.actions.resolve('settings.section.workspace/members');
    assert.equal(members.href, '/settings/workspace/members');
    assert.deepEqual(members.shortcut, { keys: 'Alt+M' });
    assert.deepEqual(runtime.destinationOf(members), { kind: 'settings', plugin: 'workspace' });
    assert.equal(
      runtime.actions.resolve('settings.section.workspace/invites').href,
      '/settings/account/invitations',
    );
  } finally {
    await view.unmount();
  }
});
