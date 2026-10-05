import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { installDom, mount, tick, testUI } from './support.mjs';
import {
  FoundationProvider,
  PluginSlot,
  createMemorySettingsStorage,
  defineAction,
  definePlugin,
  defineSettings,
  setting,
  useFoundation,
  useNavigation,
  useSetting,
  useSettingsCatalog,
  useSlot,
  defineSlot,
} from '../dist/index.js';

installDom();

test('useSetting reads and writes through the runtime store; useSettingsCatalog derives sections', async () => {
  const storage = createMemorySettingsStorage({ 'todos.pageSize': 40 });
  const Page = () => h('p', null, 'custom');
  const todos = definePlugin({
    id: 'todos',
    metadata: { name: 'Todos' },
    settings: defineSettings(
      {
        pageSize: setting({ default: 20, label: 'Page size' }),
        internal: setting({ default: true, hidden: true }),
      },
      { category: 'content', order: 5 },
    ),
  });
  const notes = definePlugin({ id: 'notes', ui: { settings: { component: Page } } });
  const config = {
    settings: defineSettings({
      theme: setting({
        default: 'system',
        options: [{ value: 'light', label: 'Light' }, { value: 'system' }],
      }),
    }),
    plugins: [todos, notes],
  };
  let seen;
  let catalog;
  function Consumer() {
    seen = useSetting('todos.pageSize');
    catalog = useSettingsCatalog();
    return h('span', null, String(seen.value));
  }
  const view = await mount(
    h(
      FoundationProvider,
      { config, services: { 'settings.storage': storage }, ui: testUI },
      h(Consumer),
    ),
  );
  try {
    await act(tick);
    assert.equal(seen.value, 40, 'the stored value replaces the default once loaded');
    assert.equal(seen.ready, true);
    assert.equal(seen.disabled, false);
    assert.equal(seen.definition.default, 20);
    assert.equal(view.container.textContent, '40');
    await act(() => seen.set(25));
    assert.equal(seen.value, 25);
    assert.equal(storage.data.get('user:anonymous/todos.pageSize'), 25);
    assert.equal(view.container.textContent, '25');

    assert.deepEqual(
      catalog.map((section) => [section.id, section.path, section.category, section.order]),
      [
        ['app', 'general', 'general', -10],
        ['notes', 'notes', 'plugins', 0],
        ['todos', 'todos', 'content', 5],
      ],
    );
    const [general, notesSection, todosSection] = catalog;
    assert.equal(general.title, 'General');
    assert.deepEqual(
      general.fields[0].options.map((option) => option.label),
      ['Light', 'System'],
      'option labels fall back to the declaration, then the value',
    );
    assert.equal(notesSection.component, Page);
    assert.equal(notesSection.fields.length, 0);
    assert.equal(todosSection.title, 'Todos');
    assert.deepEqual(
      todosSection.fields.map((field) => [field.key, field.label]),
      [['todos.pageSize', 'Page size']],
      'hidden settings stay out of the catalog',
    );
  } finally {
    await view.unmount();
  }
});

test('useSlot and useNavigation hand layouts the data PluginSlot and the menus render', async () => {
  const tools = definePlugin({
    id: 'tools',
    ui: {
      slots: [
        { slot: 'app-bar.end', component: () => h('b', null, 'badge'), order: 2 },
        { slot: 'app-bar.end', component: () => h('i', null, 'first'), order: 1 },
        { slot: 'sidebar.top', component: () => h('u', null, 'elsewhere') },
      ],
    },
    actions: {
      home: defineAction({ title: 'Home', href: '/', groups: ['navigation'], slots: ['shell.navigation'] }),
      docs: defineAction({ title: 'Docs', href: '/docs', groups: ['navigation'], slots: ['shell.navigation'], order: 2 }),
    },
  });
  let slot;
  let navigation;
  function Consumer() {
    slot = useSlot('app-bar.end');
    navigation = useNavigation();
    return h('section', null, h(PluginSlot, { name: 'app-bar.end' }));
  }
  const view = await mount(
    h(
      FoundationProvider,
      { config: { slots: { 'shell.navigation': defineSlot({ accepts: 'actions' }) }, plugins: [tools] }, ui: testUI, actionOptions: { pathname: '/docs' } },
      h(Consumer),
    ),
  );
  try {
    await act(tick);
    assert.deepEqual(
      slot.items.map((entry) => [entry.key, entry.plugin, entry.order]),
      [
        ['tools:1', 'tools', 1],
        ['tools:0', 'tools', 2],
      ],
    );
    assert.equal(view.container.querySelector('section').textContent, 'firstbadge');
    assert.deepEqual(
      navigation.items.map(item => item.title),
      ['Home', 'Docs'],
    );
    assert.equal(navigation.pathname, '/docs');
    assert.equal(navigation.isActive('/docs?tab=1'), true);
    assert.equal(navigation.isActive('/'), false);
  } finally {
    await view.unmount();
  }
});

test('dialog actions name a frame kind; the host supplies frames, the default kind uses the dialog primitives', async () => {
  const Sheet = ({ title, kind, size, actionId, children }) =>
    h(
      'aside',
      { 'data-kind': kind, 'data-size': size, 'data-action': actionId },
      h('h3', null, title),
      children,
    );
  const files = definePlugin({
    id: 'files',
    actions: {
      upload: defineAction({
        title: 'Upload',
        dialog: { component: () => h('form', null, 'drop'), kind: 'sheet', size: 'wide' },
      }),
      rename: defineAction({ title: 'Rename', dialog: () => h('input') }),
    },
  });
  let runtime;
  function Consumer() {
    runtime = useFoundation().runtime;
    return null;
  }
  const view = await mount(
    h(
      FoundationProvider,
      { config: { plugins: [files] }, ui: testUI, dialogs: { sheet: Sheet } },
      h(Consumer),
    ),
  );
  try {
    await act(() => runtime.actions.execute('files.upload'));
    const sheet = view.container.querySelector('aside');
    assert.ok(sheet, 'the sheet frame renders the dialog');
    assert.equal(sheet.dataset.kind, 'sheet');
    assert.equal(sheet.dataset.size, 'wide');
    assert.equal(sheet.dataset.action, 'files.upload');
    assert.equal(sheet.querySelector('h3').textContent, 'Upload');
    assert.equal(sheet.querySelector('form').textContent, 'drop');
    await act(async () => runtime.close());
    assert.equal(view.container.querySelector('aside'), null);
    await act(() => runtime.actions.execute('files.rename'));
    const dialog = view.container.querySelector('[role="dialog"]');
    assert.ok(dialog, 'the default kind uses the host dialog primitives');
    assert.equal(dialog.querySelector('h2').textContent, 'Rename');
    assert.ok(dialog.querySelector('input'));
  } finally {
    await view.unmount();
  }
});
