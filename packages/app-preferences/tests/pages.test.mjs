import { click, controlledStorage, renderApp, setMobile, text, tick } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement as h } from 'react';
import { definePlugin, defineSettings, setting } from '@bitakit/core';
import {
  SettingsNavigation,
  SettingsOverview,
  SettingsPage,
  SettingsRoute,
  SettingsShell,
} from '../dist/index.js';
import { appPreferencesPlugin } from '../dist/foundation.js';

const BellIcon = (props) => h('svg', { ...props, 'data-icon-name': 'bell' });
let pageProps;
function NotesPage(props) {
  pageProps = props;
  return h('p', { 'data-custom': 'notes' }, 'Notes are configured here.');
}
const todos = definePlugin({
  id: 'todos',
  metadata: { name: 'Todos' },
  settings: defineSettings(
    {
      pageSize: setting({ default: 20, label: 'Page size' }),
      sort: setting({ default: 'due', label: 'Sort order', options: [{ value: 'due' }] }),
    },
    { title: 'Tasks', description: 'Lists and sorting.', category: 'content', icon: BellIcon },
  ),
});
const alerts = definePlugin({
  id: 'alerts',
  settings: defineSettings(
    { email: setting({ default: true, label: 'Email alerts' }) },
    { title: 'Notifications', category: 'account' },
  ),
});
const notes = definePlugin({
  id: 'notes',
  settings: defineSettings({ ignored: setting({ default: 1, label: 'Ignored' }) }),
  ui: { settings: { component: NotesPage } },
});
const config = {
  settings: defineSettings({ compact: setting({ default: false, label: 'Compact mode' }) }),
  plugins: [appPreferencesPlugin(), todos, alerts, notes],
};
const headings = (container) => [...container.querySelectorAll('h1')].map(text);
const entries = (container) =>
  [...container.querySelectorAll('nav[aria-label="Settings navigation"] a')].map((link) => [
    text(link),
    link.getAttribute('href'),
    link.getAttribute('aria-current'),
  ]);

test('SettingsRoute shows the first page at the base path and every page by category', async () => {
  const view = await renderApp(h(SettingsRoute), {
    config,
    storage: controlledStorage(),
    pathname: '/settings',
  });
  try {
    const { container } = view;
    assert.deepEqual(headings(container), ['General'], 'the base path shows the first page');
    assert.ok(container.querySelector('[data-setting="compact"]'));
    assert.deepEqual(
      [...container.querySelectorAll('nav[aria-label="Settings navigation"] h2')].map(text),
      ['General', 'Account', 'Integrations', 'Content'],
      'known categories in order, unknown ones after them',
    );
    assert.deepEqual(entries(container), [
      ['General', '/settings/general', 'page'],
      ['Notifications', '/settings/alerts', null],
      ['Notes', '/settings/notes', null],
      ['Plugins', '/settings/plugins', null],
      ['Tasks', '/settings/todos', null],
    ]);
    const breadcrumb = container.querySelector('nav[aria-label="Breadcrumb"]');
    assert.deepEqual([...breadcrumb.querySelectorAll('li:not([aria-hidden])')].map(text), [
      'Settings',
      'General',
    ]);
    assert.equal(breadcrumb.querySelector('a').getAttribute('href'), '/settings');
    assert.equal(breadcrumb.querySelector('[aria-current=page]').textContent, 'General');
    const skip = container.querySelector('a[href^="#"]');
    assert.equal(text(skip), 'Skip to settings');
    assert.ok(document.getElementById(skip.getAttribute('href').slice(1)), 'skip target exists');
    assert.equal(
      container.querySelector('a[href="/"]').textContent.trim(),
      'Back to app',
      'the back link leads to backHref',
    );
  } finally {
    await view.unmount();
  }
});

test('SettingsRoute renders the page at the path and reports unknown pages', async () => {
  const view = await renderApp(h(SettingsRoute, { pathname: '/settings/todos' }), {
    config,
    storage: controlledStorage(),
  });
  try {
    assert.deepEqual(headings(view.container), ['Tasks']);
    assert.match(text(view.container), /Lists and sorting\./);
    assert.ok(view.container.querySelector('[data-setting="todos.pageSize"]'));
    assert.ok(view.container.querySelector('[data-icon-name=bell][aria-hidden=true]'));
    assert.deepEqual(
      entries(view.container).find(([title]) => title === 'Tasks'),
      ['Tasks', '/settings/todos', 'page'],
    );
  } finally {
    await view.unmount();
  }
  const missing = await renderApp(h(SettingsRoute, { pathname: '/settings/nope' }), {
    config,
    storage: controlledStorage(),
  });
  try {
    assert.equal(
      text(missing.container.querySelector('main [role=status]')),
      'This settings page is not available.',
    );
    assert.deepEqual(
      [...missing.container.querySelectorAll('nav[aria-label="Breadcrumb"] li')].map(text),
      ['Settings'],
      'no section, no second crumb',
    );
  } finally {
    await missing.unmount();
  }
});

test('a plugin settings page replaces the generated page and receives its section', async () => {
  const view = await renderApp(
    h(SettingsRoute, { basePath: '/preferences', pathname: '/preferences/notes/' }),
    { config, storage: controlledStorage() },
  );
  try {
    assert.deepEqual(headings(view.container), ['Notes']);
    assert.ok(view.container.querySelector('[data-custom=notes]'));
    assert.equal(view.container.querySelector('[data-setting="notes.ignored"]'), null);
    assert.equal(pageProps.section.id, 'notes');
    assert.deepEqual(
      entries(view.container).map(([, href]) => href),
      [
        '/preferences/general',
        '/preferences/alerts',
        '/preferences/notes',
        '/preferences/plugins',
        '/preferences/todos',
      ],
    );
  } finally {
    await view.unmount();
  }
});

test('SettingsPage takes the unavailable text and the link component from the route', async () => {
  const Link = ({ href, children, ...props }) =>
    h('a', { href, 'data-link': 'host', ...props }, children);
  const view = await renderApp(
    h('div', null, [
      h(SettingsPage, { key: 'page', pathname: '/settings/missing', unavailable: 'Gone.' }),
      h(SettingsRoute, { key: 'route', pathname: '/settings/alerts', linkComponent: Link }),
    ]),
    { config, storage: controlledStorage() },
  );
  try {
    assert.equal(text(view.container.querySelector('[role=status]')), 'Gone.');
    const links = [...view.container.querySelectorAll('nav[aria-label="Settings navigation"] a')];
    assert.ok(links.length && links.every((link) => link.dataset.link === 'host'));
  } finally {
    await view.unmount();
  }
});

test('the sidebar search filters the navigation through the q parameter', async () => {
  const view = await renderApp(h(SettingsRoute, { pathname: '/settings/todos' }), {
    config,
    storage: controlledStorage(),
    search: '?q=email',
  });
  try {
    const input = view.container.querySelector('input[aria-label="Search settings"]');
    assert.equal(input.value, 'email');
    assert.deepEqual(entries(view.container), [
      ['Notifications', '/settings/alerts?q=email', null],
    ]);
    await click(view.container.querySelector('button[aria-label="Clear search"]'));
    assert.equal(input.value, '');
    assert.equal(entries(view.container).length, 5);
    assert.equal(view.urls.at(-1), '', 'clearing removes the parameter');
  } finally {
    await view.unmount();
  }
  const none = await renderApp(
    h(SettingsShell, { pathname: '/settings/todos' }, h('p', null, 'content')),
    { config, storage: controlledStorage(), search: '?q=zzz' },
  );
  try {
    const nav = none.container.querySelector('nav[aria-label="Settings navigation"]');
    assert.equal(text(nav.querySelector('[role=status]')), 'No settings found');
  } finally {
    await none.unmount();
  }
});

test('SettingsNavigation filters by query and marks the exact path as current', async () => {
  const view = await renderApp(
    h(SettingsNavigation, { pathname: '/settings/todos', query: 'page' }),
    { config, storage: controlledStorage() },
  );
  try {
    assert.deepEqual(entries(view.container), [['Tasks', '/settings/todos?q=page', 'page']]);
  } finally {
    await view.unmount();
  }
});

test('embedded shells drop the back link; narrow screens use a drawer that closes on navigation', async () => {
  const embedded = await renderApp(
    h(SettingsShell, { pathname: '/settings/todos', embedded: true }, h('p', null, 'body')),
    { config, storage: controlledStorage() },
  );
  try {
    assert.equal(embedded.container.querySelector('a[href="/"]'), null);
    assert.ok(embedded.container.querySelector('nav[aria-label="Settings navigation"]'));
    assert.equal(
      embedded.container.querySelector('[data-slot=sidebar][data-state]'),
      null,
      'the embedded sidebar is not collapsible on wide screens',
    );
  } finally {
    await embedded.unmount();
  }

  await setMobile(true);
  const view = await renderApp(
    h(SettingsShell, { pathname: '/settings/todos' }, h('p', null, 'body')),
    { config, storage: controlledStorage() },
  );
  try {
    assert.equal(
      document.querySelector('nav[aria-label="Settings navigation"]'),
      null,
      'the drawer starts closed',
    );
    await click(view.container.querySelector('button[aria-label="Toggle settings navigation"]'));
    await act(tick);
    const drawer = document.querySelector('[data-mobile=true]');
    assert.ok(drawer, 'the navigation opens as a drawer');
    assert.equal(drawer.getAttribute('role'), 'dialog');
    const link = [...drawer.querySelectorAll('a')].find((node) => text(node) === 'Notifications');
    link.addEventListener('click', (event) => event.preventDefault());
    await click(link);
    await act(tick);
    assert.equal(document.querySelector('[data-mobile=true]'), null, 'following a link closes it');
  } finally {
    await view.unmount();
    await setMobile(false);
  }
});

test('SettingsOverview lists pages with their fields, searches and resets the search', async () => {
  const view = await renderApp(h(SettingsOverview), {
    config,
    storage: controlledStorage(),
    search: '?q=order',
  });
  try {
    const { container } = view;
    const input = container.querySelector('input');
    assert.equal(
      text(container.querySelector(`label[for="${input.id}"]`)),
      'Search settings',
      'the overview search has a visible label',
    );
    assert.deepEqual([...container.querySelectorAll('section h2')].map(text), ['Content']);
    const item = container.querySelector('a[href="/settings/todos"]');
    assert.match(text(item), /Tasks/);
    assert.match(text(item), /Sort order/);
    assert.doesNotMatch(text(item), /Page size/, 'only the matching fields are listed');
    assert.equal(text(container.querySelector('[role=status]')), '1 section found');

    const nothing = await renderApp(h(SettingsOverview), {
      config,
      storage: controlledStorage(),
      search: '?q=nothing',
    });
    try {
      assert.match(text(nothing.container), /No settings found/);
      await click(
        [...nothing.container.querySelectorAll('button')].find(
          (button) => text(button) === 'Reset search',
        ),
      );
      assert.equal(nothing.urls.at(-1), '');
      assert.equal(nothing.container.querySelectorAll('a').length, 5);
    } finally {
      await nothing.unmount();
    }
  } finally {
    await view.unmount();
  }
  const controlled = await renderApp(h(SettingsOverview, { query: 'compact' }), {
    config,
    storage: controlledStorage(),
  });
  try {
    assert.equal(controlled.container.querySelector('input'), null, 'the host owns the query');
    assert.deepEqual(
      [...controlled.container.querySelectorAll('a')].map((link) => link.getAttribute('href')),
      ['/settings/general'],
    );
  } finally {
    await controlled.unmount();
  }
});

test('additional plugin pages render through the same route with one heading and separate navigation', async () => {
  const config = {
    plugins: [
      appPreferencesPlugin(),
      definePlugin({
        id: 'multi',
        ui: {
          settings: {
            pages: [
              {
                id: 'members',
                title: 'Members',
                category: 'organization',
                component: () => h('p', null, 'Member content'),
              },
              {
                id: 'invitations',
                title: 'My invitations',
                path: 'account/invitations',
                category: 'account',
                component: () => h('p', null, 'Incoming content'),
              },
            ],
          },
        },
      }),
    ],
  };
  const view = await renderApp(h(SettingsRoute, { pathname: '/settings/multi/members' }), {
    config,
  });
  try {
    assert.deepEqual(headings(view.container), ['Members']);
    assert.match(view.container.textContent, /Member content/);
    assert.ok(view.container.querySelector('a[href="/settings/account/invitations"]'));
    assert.equal(
      view.container
        .querySelector('a[href="/settings/multi/members"]')
        .getAttribute('aria-current'),
      'page',
    );
  } finally {
    await view.unmount();
  }
});
