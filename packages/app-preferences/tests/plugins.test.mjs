import { controlledStorage, renderApp, text, type, press, click } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { definePlugin, defineSettings, setting, withPluginOrigin } from '@bitakit/core';
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
  [...container.querySelectorAll('[role="list"][aria-label="Plugins"] a')].map((link) => [
    text(link.querySelector('[data-slot="item-title"] > span')),
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
    assert.equal(text(card.querySelector('[data-slot="item-title"] [data-slot="badge"]')), '1.2.0');
    assert.equal(
      container.querySelector('a[href*="plugin=bare"] [data-slot="badge"]'),
      null,
      'plugins without a version or tags have no placeholder badges',
    );
    assert.deepEqual([...card.querySelectorAll('[data-slot="badge"]')].map(text), [
      '1.2.0',
      'productivity',
      'team',
    ]);
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
    assert.equal(text(container.querySelector('[data-slot=empty-title]')), 'No plugins found.');
    assert.equal(
      text(container.querySelector('[data-slot=empty-description]')),
      'Try another search or change the filters.',
    );
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
    assert.ok(container.querySelector('[role="list"][aria-label="Plugins"]'));
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

test('tag and status URL state combine with search and survive plugin details', async () => {
  const view = await renderApp(h(PluginsOverview), {
    config,
    pathname: '/settings/plugins',
    search: '?pluginTag=team&pluginSearch=task&pluginStatus=enabled',
  });
  try {
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['Todos'],
    );
    assert.match(items(view.container)[0][1], /pluginTag=team/);
    assert.match(items(view.container)[0][1], /pluginStatus=enabled/);
    assert.match(
      text(view.container.querySelector('[role="list"][aria-label="Plugins"]')),
      /productivity/,
    );
    await type(view.container.querySelector('input[aria-label="Search plugins"]'), 'zzz');
    assert.equal(
      text(view.container.querySelector('[data-slot=empty-title]')),
      'No plugins found.',
    );
    assert.equal(
      text(view.container.querySelector('[data-slot=empty-description]')),
      'Try another search or change the filters.',
    );
    assert.match(view.urls.at(-1), /pluginTag=team/);
    assert.match(view.urls.at(-1), /pluginStatus=enabled/);
  } finally {
    await view.unmount();
  }
  const detail = await renderApp(h(PluginsOverview), {
    config,
    pathname: '/settings/plugins',
    search: '?plugin=todos&pluginTag=team&pluginSearch=task&pluginStatus=enabled',
  });
  try {
    assert.equal(
      detail.container.querySelector('header a').getAttribute('href'),
      '/settings/plugins?pluginSearch=task&pluginTag=team&pluginStatus=enabled',
    );
  } finally {
    await detail.unmount();
  }
});

test('status defaults to all plugins and invalid URL values use the same default', async () => {
  for (const search of ['', '?pluginStatus=unknown']) {
    const view = await renderApp(h(PluginsOverview), { config, search });
    try {
      assert.equal(items(view.container).length, 4);
      const trigger = view.container.querySelector('button[aria-label="Filter by status"]');
      assert.equal(text(trigger), 'All plugins');
      await press(trigger, 'Enter');
      const options = [...document.querySelectorAll('[role=menuitemradio]')];
      assert.deepEqual(options.map(text), ['All plugins', 'Enabled', 'Disabled']);
      assert.equal(options[0].getAttribute('aria-checked'), 'true');
      await click(options[0]);
      assert.ok(!view.urls.at(-1)?.includes('pluginStatus'));
    } finally {
      await view.unmount();
    }
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

test('the grouped list shows every filtered result and ignores legacy pagination parameters', async () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    definePlugin({ id: `sample-${i}`, metadata: { name: `Sample ${i}` } }),
  );
  const view = await renderApp(h(PluginsOverview), {
    config: { plugins: many },
    pathname: '/settings/plugins',
    search: '?pluginPageSize=5&pluginPage=2',
  });
  try {
    assert.equal(items(view.container).length, 12);
    assert.equal(view.container.querySelector('[aria-label="Plugin pagination"]'), null);
    assert.equal(view.container.querySelectorAll('[data-slot=item-separator]').length, 11);
    await type(view.container.querySelector('input[aria-label="Search plugins"]'), 'Sample 1');
    assert.equal(items(view.container).length, 3);
  } finally {
    await view.unmount();
  }
});

test('bundle grouping restores from the URL, counts distinct plugins and shares enablement', async () => {
  const origin = (id, kind, memberOf) =>
    withPluginOrigin(definePlugin({ id, metadata: { name: id } }), { kind, memberOf });
  const groupedConfig = {
    bundle: 'host',
    knownBundles: [{ id: 'other', label: 'Other application' }],
    plugins: [
      appPreferencesPlugin(),
      origin('local', 'local'),
      origin('multi', 'package', ['HOST', 'other']),
      origin('general', 'package', ['*']),
      origin('unresolved', 'package', ['missing']),
      definePlugin({ id: 'legacy' }),
    ],
  };
  const view = await renderApp(h(PluginsOverview), {
    config: groupedConfig,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?pluginView=grouped',
  });
  try {
    const lists = [...view.container.querySelectorAll('[role="list"]')];
    assert.deepEqual(
      lists.map((list) => list.getAttribute('aria-label')),
      [
        'This application',
        'Other application',
        'missing (unresolved)',
        'General purpose',
        'Not assigned',
      ],
    );
    assert.equal(view.container.querySelectorAll('a[href*="plugin=multi"]').length, 2);
    assert.match(text(view.container.querySelector('p[role="status"]')), /^6 plugins$/);
    assert.match(
      view.container.querySelector('a[href*="plugin=multi"]').getAttribute('href'),
      /pluginView=grouped/,
    );
    const switches = [...view.container.querySelectorAll('button[role="switch"]')].filter((item) =>
      item.getAttribute('aria-label')?.includes('multi'),
    );
    assert.equal(switches.length, 2);
    await click(switches[0]);
    await click(
      [...view.container.querySelectorAll('[role="dialog"] button')].find(
        (item) => text(item) === 'Confirm',
      ),
    );
    const updated = [...view.container.querySelectorAll('button[role="switch"]')].filter((item) =>
      item.getAttribute('aria-label')?.includes('multi'),
    );
    assert.ok(updated.every((item) => item.getAttribute('aria-checked') === 'false'));
    await type(view.container.querySelector('input[aria-label="Search plugins"]'), 'legacy');
    assert.equal(view.container.querySelectorAll('[role="list"] a').length, 1);
    assert.equal(
      view.container.querySelector('[role="list"]').getAttribute('aria-label'),
      'Not assigned',
    );
    assert.match(view.urls.at(-1), /pluginView=grouped/);
  } finally {
    await view.unmount();
  }
  const filtered = await renderApp(h(PluginsOverview), {
    config: groupedConfig,
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?pluginView=grouped&pluginBundle=bundle%3AOTHER',
  });
  try {
    assert.equal(filtered.container.querySelectorAll('[role="list"]').length, 1);
    assert.equal(
      filtered.container.querySelector('[role="list"]').getAttribute('aria-label'),
      'Other application',
    );
    assert.match(text(filtered.container.querySelector('p[role="status"]')), /^1 plugin$/);
  } finally {
    await filtered.unmount();
  }
});

test('this-application filtering includes local plugins when the application has no bundle ID', async () => {
  const view = await renderApp(h(PluginsOverview), {
    config: {
      plugins: [
        appPreferencesPlugin(),
        withPluginOrigin(definePlugin({ id: 'local' }), { kind: 'local' }),
        definePlugin({ id: 'unknown' }),
      ],
    },
    storage: controlledStorage(),
    pathname: '/settings/plugins',
    search: '?pluginBundle=application',
  });
  try {
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['local'],
    );
  } finally {
    await view.unmount();
  }
});

test('display titles retain application translations and each legacy fallback', async () => {
  const sources = [
    withPluginOrigin(
      definePlugin({ id: 'translated', metadata: { title: 'Canonical', name: 'Legacy' } }),
      { kind: 'package', package: { name: '@fixture/translated', version: null } },
    ),
    withPluginOrigin(
      definePlugin({ id: 'canonical', metadata: { title: 'Canonical title', name: 'Legacy' } }),
      { kind: 'package', package: { name: '@fixture/canonical', version: null } },
    ),
    withPluginOrigin(definePlugin({ id: 'legacy-title', metadata: { name: 'Legacy title' } }), {
      kind: 'package',
      package: { name: '@fixture/legacy', version: null },
    }),
    withPluginOrigin(definePlugin({ id: 'package-name' }), {
      kind: 'package',
      package: { name: '@FIXTURE/Name', version: null },
    }),
    definePlugin({ id: 'runtime-id' }),
  ];
  const translate = Object.assign(
    (key) => (key === 'plugins.translated.name' ? 'App translation' : key),
    { has: (key) => key === 'plugins.translated.name' },
  );
  const view = await renderApp(h(PluginsOverview), {
    config: { plugins: sources },
    translate,
    pathname: '/settings/plugins',
  });
  try {
    assert.deepEqual(
      items(view.container).map(([name]) => name),
      ['App translation', 'Canonical title', 'Legacy title', '@fixture/name', 'runtime-id'],
    );
  } finally {
    await view.unmount();
  }
});
