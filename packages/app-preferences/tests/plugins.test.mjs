import { controlledStorage, renderApp, text, type } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { definePlugin, defineSettings, setting } from '@bitakit/ui';
import { PluginsOverview, SettingsRoute } from '../dist/index.js';
import { appPreferencesPlugin } from '../dist/foundation.js';

const TodoIcon = (props) => h('svg', { ...props, 'data-icon-name': 'todo' });
const todos = definePlugin({
  id: 'todos',
  metadata: {
    name: 'Todos',
    description: 'Task lists for teams.',
    version: '1.2.0',
    author: { name: 'Ada' },
    license: 'MIT',
    homepage: 'https://example.com/todos',
    bugs: { url: 'https://example.com/todos/issues' },
    icon: TodoIcon,
  },
  settings: defineSettings({ pageSize: setting({ default: 20, label: 'Page size' }) }),
});
const Page = () => h('p', null, 'custom');
const reports = definePlugin({
  id: 'reports',
  metadata: { name: 'Reports', homepage: 'javascript:alert(1)' },
  ui: { settings: { component: Page } },
});
const bare = definePlugin({ id: 'bare' });
const config = {
  settings: defineSettings({ compact: setting({ default: false }) }),
  plugins: [appPreferencesPlugin(), todos, reports, bare],
};
const messages = {
  'plugins.bare.name': 'Bare plugin',
  'plugins.bare.description': 'Does nothing.',
};
const translate = Object.assign((key) => messages[key] ?? key, {
  has: (key) => Object.hasOwn(messages, key),
});
const details = (info) =>
  [...info.querySelectorAll('dt')].map((term) => [text(term), text(term.nextElementSibling)]);
const items = (container) =>
  [...container.querySelectorAll('ul[aria-label="Plugins"] a')].map((link) => [
    text(link.querySelector('[data-slot=item-title]')),
    link.getAttribute('href'),
  ]);

test('PluginsOverview lists the installed plugins with their metadata and searches them', async () => {
  const view = await renderApp(h(PluginsOverview), {
    config,
    translate,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?q=todo',
  });
  try {
    const { container } = view;
    assert.deepEqual(items(container), [
      ['App Preferences', '/settings/plugins?plugin=app-preferences&q=todo'],
      ['Todos1.2.0', '/settings/plugins?plugin=todos&q=todo'],
      ['Reports', '/settings/plugins?plugin=reports&q=todo'],
      ['Bare plugin', '/settings/plugins?plugin=bare&q=todo'],
    ]);
    const card = container.querySelector('a[href*="plugin=todos"]');
    assert.match(text(card), /Task lists for teams\./);
    assert.match(text(card), /By Ada/);
    assert.ok(card.querySelector('[data-icon-name=todo][aria-hidden=true]'));
    assert.match(text(container.querySelector('a[href*="plugin=bare"]')), /Does nothing\./);

    const input = container.querySelector('input[aria-label="Search plugins"]');
    await type(input, 'task');
    assert.deepEqual(
      items(container).map(([name]) => name),
      ['Todos1.2.0'],
      'the search matches names and descriptions',
    );
    assert.equal(view.urls.at(-1), '?q=todo&pluginSearch=task');
    await type(input, 'zzz');
    assert.equal(text(container.querySelector('[role=status]')), 'No plugins found.');
  } finally {
    await view.unmount();
  }
});

test('the plugin view shows details, links safely and renders the plugin settings', async () => {
  const view = await renderApp(h(PluginsOverview), {
    config,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?plugin=todos&pluginSearch=to',
  });
  try {
    const { container } = view;
    assert.equal(text(container.querySelector('h2')), 'Todos');
    const back = [...container.querySelectorAll('a')].find(
      (link) => text(link) === 'Back to plugins',
    );
    assert.equal(back.getAttribute('href'), '/settings/plugins?pluginSearch=to');
    const info = container.querySelector('aside');
    assert.equal(
      info.getAttribute('aria-labelledby'),
      info.querySelector('[data-slot=card-title]').id,
    );
    assert.deepEqual(details(info), [
      ['Version', '1.2.0'],
      ['License', 'MIT'],
      ['Website', 'Project website'],
      ['Support', 'Get help and report issues'],
    ]);
    assert.equal(
      [...info.querySelectorAll('a')].map((link) => link.getAttribute('href')).join(),
      'https://example.com/todos,https://example.com/todos/issues',
    );
    const about = [...container.querySelectorAll('section')].find(
      (section) =>
        text(document.getElementById(section.getAttribute('aria-labelledby'))) ===
        'About this plugin',
    );
    assert.equal(text(about.querySelector('p')), 'Task lists for teams.');
    assert.ok(
      container.querySelector('[data-setting="todos.pageSize"] input[type=number]'),
      'a plugin with settings shows its fields',
    );
  } finally {
    await view.unmount();
  }

  const custom = await renderApp(h(PluginsOverview), {
    config,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?plugin=reports',
  });
  try {
    const { container } = custom;
    assert.equal(
      container.querySelector('aside a'),
      null,
      'unsafe or missing links are not rendered',
    );
    assert.deepEqual(details(container.querySelector('aside')), [['Version', 'Not specified']]);
    const open = container.querySelector('a[href="/settings/reports"]');
    assert.match(text(open), /Open settings/, 'a custom settings page is linked');
    assert.match(text(container), /No description is available for this plugin\./);
  } finally {
    await custom.unmount();
  }

  const missing = await renderApp(h(PluginsOverview), {
    config,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?plugin=ghost',
  });
  try {
    assert.match(text(missing.container), /Plugin unavailable/);
    assert.match(text(missing.container), /This plugin is not installed\./);
  } finally {
    await missing.unmount();
  }
});

test('the Plugins page is App Preferences’ own settings page in the route', async () => {
  const view = await renderApp(h(SettingsRoute, { pathname: '/settings/plugins' }), {
    config,
    storage: controlledStorage(),
  });
  try {
    const { container } = view;
    assert.deepEqual([...container.querySelectorAll('h1')].map(text), ['Plugins']);
    assert.match(text(container), /Installed plugins and their settings\./);
    assert.ok(container.querySelector('ul[aria-label="Plugins"]'));
  } finally {
    await view.unmount();
  }
  const self = await renderApp(h(PluginsOverview), {
    config,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?plugin=app-preferences',
  });
  try {
    assert.match(
      text(self.container),
      /This plugin has no settings\./,
      'the overview does not link to itself',
    );
  } finally {
    await self.unmount();
  }
});
