import { controlledStorage, renderApp, text, type, press, click } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
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
    tags: ['productivity', 'team'],
    coverImage: '/missing-cover.png',
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
  metadata: { name: 'Reports', tags: ['reporting'], homepage: 'javascript:alert(1)' },
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
  [...container.querySelectorAll('table[aria-label="Plugins"] a')].map((link) => [
    text(link.querySelector('.font-medium')),
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
      ['Todos', '/settings/plugins?plugin=todos&q=todo'],
      ['Reports', '/settings/plugins?plugin=reports&q=todo'],
      ['Bare plugin', '/settings/plugins?plugin=bare&q=todo'],
    ]);
    const card = container.querySelector('a[href*="plugin=todos"]');
    assert.match(text(card), /Task lists for teams\./);
    assert.match(text(card), /By Ada/);
    assert.ok(card.querySelector('img'));
    await act(async () => card.querySelector('img').dispatchEvent(new window.Event('error')));
    assert.ok(
      card.querySelector('[data-icon-name=todo][aria-hidden=true]'),
      'a broken cover falls back to the plugin icon',
    );
    assert.match(text(container.querySelector('a[href*="plugin=bare"]')), /Does nothing\./);

    const input = container.querySelector('input[aria-label="Search plugins"]');
    await type(input, 'task');
    assert.deepEqual(
      items(container).map(([name]) => name),
      ['Todos'],
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
    assert.equal(text(container.querySelector('h1')), 'Todos');
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
    assert.ok(container.querySelector('table[aria-label="Plugins"]'));
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
    assert.ok(
      self.container.querySelector('a[href="/settings/plugins"]'),
      'the plugin exposes its own settings page',
    );
  } finally {
    await self.unmount();
  }
});

test('plugin details list all owned settings pages and include App Preferences itself', async () => {
  const multi = definePlugin({
    id: 'multi',
    ui: {
      settings: {
        component: Page,
        pages: [{ id: 'security', title: 'Security', component: Page, path: 'account/security' }],
      },
    },
  });
  for (const [id, paths] of [
    ['multi', ['/settings/multi', '/settings/account/security']],
    ['app-preferences', ['/settings/plugins']],
  ]) {
    const view = await renderApp(h(SettingsRoute, { pathname: '/settings/plugins' }), {
      config: { plugins: [appPreferencesPlugin(), multi] },
      search: `?plugin=${id}`,
    });
    try {
      assert.equal(view.container.querySelectorAll('h1').length, 1);
      for (const path of paths)
        assert.ok(view.container.querySelector(`section a[href="${path}"]`));
      const header = view.container.querySelector('section header');
      assert.match(header.firstElementChild.textContent, /Back to plugins/);
      assert.ok(!view.container.textContent.includes('This plugin has no settings page'));
    } finally {
      await view.unmount();
    }
  }
});

test('tag URL state combines with search and survives plugin details', async () => {
  const view = await renderApp(h(PluginsOverview), {
    config,
    pathname: '/settings/plugins',
    search: '?pluginTag=team&pluginSearch=task',
  });
  try {
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['Todos'],
    );
    assert.match(items(view.container)[0][1], /pluginTag=team/);
    assert.match(text(view.container.querySelector('tbody')), /productivity/);
    await type(view.container.querySelector('input[aria-label="Search plugins"]'), 'zzz');
    assert.equal(text(view.container.querySelector('[role=status]')), 'No plugins found.');
    assert.match(view.urls.at(-1), /pluginTag=team/);
  } finally {
    await view.unmount();
  }
  const detail = await renderApp(h(PluginsOverview), {
    config,
    pathname: '/settings/plugins',
    search: '?plugin=todos&pluginTag=team&pluginSearch=task',
  });
  try {
    assert.equal(
      detail.container.querySelector('header a').getAttribute('href'),
      '/settings/plugins?pluginSearch=task&pluginTag=team',
    );
  } finally {
    await detail.unmount();
  }
});

test('multiple tags use union matching, remain checked and can be cleared together', async () => {
  const view = await renderApp(h(PluginsOverview), {
    config,
    pathname: '/settings/plugins',
    search: '?pluginTag=team&pluginTag=reporting',
  });
  try {
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['Todos', 'Reports'],
    );
    await press(view.container.querySelector('button[aria-label="Filter by tag"]'), 'Enter');
    const options = () => [...document.querySelectorAll('[role=menuitemcheckbox]')];
    assert.deepEqual(
      options()
        .filter((e) => e.getAttribute('aria-checked') === 'true')
        .map(text),
      ['reporting', 'team'],
    );
    await click(options().find((e) => text(e) === 'team'));
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['Reports'],
    );
    assert.match(view.urls.at(-1), /pluginTag=reporting/);
    assert.ok(!view.urls.at(-1).includes('pluginTag=team'));
    await click(
      [...document.querySelectorAll('[role=menuitem]')].find((e) => text(e) === 'Clear tags'),
    );
    assert.equal(items(view.container).length, 4);
    assert.ok(!view.urls.at(-1).includes('pluginTag'));
  } finally {
    await view.unmount();
  }
});

test('pagination slices results, normalizes invalid pages and resets after filtering', async () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    definePlugin({ id: `sample-${i}`, metadata: { name: `Sample ${i}` } }),
  );
  const view = await renderApp(h(PluginsOverview), {
    config: { plugins: many },
    pathname: '/settings/plugins',
    search: '?pluginPageSize=5&pluginPage=2',
  });
  try {
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['Sample 5', 'Sample 6', 'Sample 7', 'Sample 8', 'Sample 9'],
    );
    assert.match(items(view.container)[0][1], /pluginPage=2/);
    await click([...view.container.querySelectorAll('button')].find((e) => text(e) === 'Next'));
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['Sample 10', 'Sample 11'],
    );
    assert.ok(
      [...view.container.querySelectorAll('button')].find((e) => text(e) === 'Next').disabled,
    );
    await type(view.container.querySelector('input[aria-label="Search plugins"]'), 'Sample 1');
    assert.equal(items(view.container).length, 3);
    assert.ok(!view.urls.at(-1).includes('pluginPage='));
  } finally {
    await view.unmount();
  }
  const invalid = await renderApp(h(PluginsOverview), {
    config: { plugins: many },
    pathname: '/settings/plugins',
    search: '?pluginPage=999&pluginPageSize=5',
  });
  try {
    assert.equal(items(invalid.container).length, 2);
    assert.match(invalid.urls.at(-1), /pluginPage=3/);
  } finally {
    await invalid.unmount();
  }
});
