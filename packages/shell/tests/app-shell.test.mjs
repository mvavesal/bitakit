import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, settle, setMedia, click } from './support.mjs';
import { Component, createElement as h, act, useEffect } from 'react';
import {
  FoundationProvider,
  createMemorySettingsStorage,
  defineAction,
  definePlugin,
  useFoundation,
  useNavigation,
  useSetting,
  useSlot,
} from '@bitakit/ui';
import { SidebarProvider } from '@bitakit/ui/components';
import { AppShell, shellPlugin, useShellLayout } from '../dist/index.js';

const contribution = (name) => () => h('span', { 'data-contribution': name }, name);
let refreshed = 0;
const tools = definePlugin({
  id: 'tools',
  actions: {
    home: defineAction({ title: 'Home', href: '/', groups: ['navigation'], order: 1 }),
    docs: defineAction({ title: 'Docs', href: '/docs', groups: ['navigation'], order: 2 }),
    status: defineAction({
      title: 'Status',
      href: 'https://status.example.com',
      groups: ['navigation'],
      order: 3,
    }),
    refresh: defineAction({
      title: 'Refresh',
      groups: ['navigation'],
      order: 4,
      execute() {
        refreshed++;
      },
    }),
    users: defineAction({
      title: 'Users',
      href: '/admin/users',
      groups: ['admin', 'navigation'],
      order: 5,
    }),
  },
  ui: {
    slots: [
      { slot: 'sidebar.header', component: contribution('workspace') },
      { slot: 'sidebar.footer', component: contribution('profile') },
      { slot: 'app-bar.end', component: contribution('search') },
    ],
    pages: [
      { path: '/docs', component: () => null },
      { path: '/print', component: () => null, layout: 'blank' },
    ],
  },
});
/** A page in a named layout; Core requires the app to declare that layout. */
const reports = definePlugin({
  id: 'reports',
  ui: { pages: [{ path: '/reports', component: () => null, layout: 'admin' }] },
});
/** The router link a framework adapter supplies. */
const RouterLink = (props) => h('a', { ...props, 'data-router-link': '' });

function setup({ layout = 'sidebar', layouts, plugins } = {}) {
  const config = {
    plugins: plugins ?? [shellPlugin({ groups: ['navigation', 'admin'] }), tools],
    ...(layouts ? { ui: { layouts } } : {}),
  };
  const services = {
    'settings.storage': createMemorySettingsStorage({ 'shell.layout': layout }),
  };
  const navigated = [];
  const navigate = (href) => navigated.push(href);
  let runtime;
  function Probe() {
    runtime = useFoundation().runtime;
    return null;
  }
  const tree = (pathname, content) =>
    h(
      FoundationProvider,
      { config, services, actionOptions: { pathname, navigate, Link: RouterLink } },
      h(Probe),
      content,
    );
  return { tree, navigated, runtime: () => runtime };
}
const texts = (elements) => [...elements].map((element) => element.textContent);
const link = (scope, title) =>
  [...scope.querySelectorAll('a')].find((a) => a.textContent === title);

test('the default frame renders navigation, slots and the page in both layouts without remounting the page', async () => {
  const { tree, runtime } = setup();
  let mounts = 0;
  function Page() {
    useEffect(() => {
      mounts++;
    }, []);
    return h('input', { 'aria-label': 'Draft', defaultValue: 'Draft' });
  }
  const shell = h(
    AppShell,
    {
      brand: h('b', null, 'Brand'),
      account: h('i', null, 'Me'),
      header: h('h1', null, 'Docs page'),
    },
    h(Page),
  );
  const view = await mount(tree('/docs', shell));
  try {
    await settle();
    const c = view.container;
    const frame = c.querySelector('[data-shell-layout]');
    assert.equal(frame.getAttribute('data-shell-layout'), 'sidebar');
    const sidebar = c.querySelector('[data-slot="sidebar"]');
    const nav = sidebar.querySelector('nav[aria-label="Main navigation"]');
    assert.deepEqual(texts(sidebar.querySelectorAll('[data-slot="sidebar-group-label"]')), [
      'General',
      'admin',
    ]);
    assert.deepEqual(
      [...nav.querySelectorAll('a, button')].map((item) => [
        item.tagName,
        item.textContent,
        item.getAttribute('href'),
      ]),
      [
        ['A', 'Home', '/'],
        ['A', 'Docs', '/docs'],
        ['A', 'Status', 'https://status.example.com'],
        ['BUTTON', 'Refresh', null],
        ['A', 'Users', '/admin/users'],
        ['A', 'Users', '/admin/users'],
      ],
    );
    const docs = link(nav, 'Docs');
    assert.equal(docs.getAttribute('aria-current'), 'page');
    assert.equal(docs.getAttribute('data-variant'), 'secondary');
    assert.equal(link(nav, 'Home').getAttribute('aria-current'), null);
    assert.equal(link(nav, 'Home').getAttribute('data-variant'), 'ghost');
    assert.ok(docs.hasAttribute('data-router-link'), 'internal links use the framework link');
    assert.ok(!link(nav, 'Status').hasAttribute('data-router-link'), 'external links stay anchors');
    assert.equal(
      sidebar.querySelector('[data-slot="sidebar-header"]').textContent,
      'Brandworkspace',
    );
    assert.equal(sidebar.querySelector('[data-slot="sidebar-footer"]').textContent, 'profileMe');

    const main = c.querySelector('main[data-slot="sidebar-inset"]');
    const bar = main.querySelector('header');
    assert.ok(bar.querySelector('[data-slot="sidebar-trigger"][aria-label="Toggle navigation"]'));
    assert.ok(bar.querySelector('h1'), 'the page header sits next to the trigger');
    assert.ok(bar.querySelector('[data-contribution="search"]'), 'app-bar.end');
    assert.equal(bar.textContent.includes('Brand'), false);
    const input = main.querySelector('input[aria-label="Draft"]');
    input.value = 'Unsaved edit';

    await act(() => runtime().settings.set('shell.layout', 'navbar'));
    assert.equal(c.querySelector('[data-shell-layout]'), frame, 'the frame element stays');
    assert.equal(frame.getAttribute('data-shell-layout'), 'navbar');
    assert.equal(c.querySelector('[data-slot="sidebar"]'), null);
    const top = frame.querySelector(':scope > header');
    const menu = top.querySelector('nav[aria-label="Main navigation"]');
    assert.deepEqual(texts(menu.querySelectorAll('a, button')), [
      'Home',
      'Docs',
      'Status',
      'Refresh',
      'Users',
    ]);
    assert.equal(link(menu, 'Docs').getAttribute('aria-current'), 'page');
    assert.equal(link(menu, 'Docs').getAttribute('data-active'), '');
    assert.ok(top.querySelector('b'), 'brand at the start');
    assert.ok(top.querySelector('i'), 'account at the end');
    assert.ok(top.querySelector('[data-contribution="search"]'));
    assert.equal(top.querySelector('h1'), null);
    assert.equal(
      c.querySelector('[data-contribution="workspace"]'),
      null,
      'sidebar slots stay in the sidebar',
    );
    assert.equal(c.querySelector('main input'), input, 'the page stays mounted');
    assert.equal(input.value, 'Unsaved edit');

    await act(() => runtime().settings.set('shell.layout', 'sidebar'));
    assert.ok(c.querySelector('[data-slot="sidebar"]'));
    assert.equal(c.querySelector('main input'), input);
    assert.equal(mounts, 1);
  } finally {
    await view.unmount();
  }
});

test('navigation entries navigate through the router and run button actions', async () => {
  const { tree, navigated } = setup();
  const view = await mount(tree('/docs', h(AppShell, null, h('p', null, 'Page'))));
  try {
    await settle();
    const nav = view.container.querySelector('nav[aria-label="Main navigation"]');
    await click(link(nav, 'Home'));
    assert.deepEqual(navigated, ['/']);
    const before = refreshed;
    await click(nav.querySelector('button'));
    assert.equal(refreshed, before + 1);
  } finally {
    await view.unmount();
  }
});

test('mobile: the sidebar is a drawer the trigger opens and navigation closes', async () => {
  await setMedia({ mobile: true });
  const { tree } = setup();
  const view = await mount(tree('/docs', h(AppShell, null, h('p', null, 'Page'))));
  try {
    await settle();
    assert.equal(document.querySelector('[data-slot="sidebar"]'), null, 'closed on mobile');
    await click(view.container.querySelector('[data-slot="sidebar-trigger"]'));
    const drawer = document.querySelector('[role="dialog"][data-mobile="true"]');
    assert.ok(drawer, 'the trigger opens the drawer');
    assert.equal(
      document.getElementById(drawer.getAttribute('aria-labelledby')).textContent,
      'Main navigation',
    );
    assert.ok(link(drawer, 'Users'));
    await view.render(tree('/admin/users', h(AppShell, null, h('p', null, 'Page'))));
    await settle();
    assert.equal(document.querySelector('[data-mobile="true"]'), null, 'navigation closes it');
  } finally {
    await view.unmount();
    await setMedia({ mobile: false });
  }
});

test('page layouts: blank renders the page bare, a named layout replaces the frame', async () => {
  function AdminLayout({ children }) {
    return h('section', { 'data-admin-layout': '' }, h(AppShell, { brand: 'Admin' }, children));
  }
  const { tree } = setup({
    layouts: { admin: AdminLayout },
    plugins: [shellPlugin({ groups: ['navigation', 'admin'] }), tools, reports],
  });
  const page = h('p', { 'data-page': '' }, 'Page');
  const view = await mount(tree('/print', h(AppShell, null, page)));
  try {
    await settle();
    const c = view.container;
    assert.equal(c.querySelector('[data-shell-layout]'), null);
    assert.ok(c.querySelector('[data-page]'));

    await view.render(tree('/reports', h(AppShell, null, page)));
    const section = c.querySelector('[data-admin-layout]');
    assert.ok(section, 'the named layout renders');
    assert.equal(
      c.querySelectorAll('[data-shell-layout]').length,
      1,
      'its AppShell draws one frame',
    );
    assert.ok(section.querySelector('main [data-page]'));
    assert.match(section.querySelector('[data-slot="sidebar-header"]').textContent, /^Admin/);

    for (const pathname of ['/docs', '/unknown']) {
      await view.render(tree(pathname, h(AppShell, null, page)));
      assert.equal(c.querySelector('[data-admin-layout]'), null, pathname);
      assert.ok(c.querySelector('[data-shell-layout] main [data-page]'), pathname);
    }
  } finally {
    await view.unmount();
  }
});

test('a custom layout written only with the hooks renders every plugin contribution', async () => {
  const { tree, runtime } = setup();
  const render = (entries) => entries.map((entry) => h(entry.component, { key: entry.key }));
  function HookLayout({ children }) {
    const navigation = useNavigation(['navigation', 'admin']);
    const layout = useSetting('shell.layout');
    const header = useSlot('sidebar.header');
    const footer = useSlot('sidebar.footer');
    const end = useSlot('app-bar.end');
    return h(
      'div',
      { 'data-layout': layout.value },
      h('header', null, render(header), render(end)),
      h(
        'nav',
        null,
        navigation.groups.map((group) =>
          h(
            'section',
            { key: group.id, 'aria-label': group.title },
            group.items.map((item) =>
              item.href === undefined
                ? h('button', { key: item.id, ...item.props() }, item.title)
                : h(
                    'a',
                    {
                      key: item.id,
                      ...item.linkProps(),
                      'aria-current': navigation.isActive(item.href) ? 'page' : undefined,
                    },
                    item.title,
                  ),
            ),
          ),
        ),
      ),
      h('main', null, children),
      h('footer', null, render(footer)),
    );
  }
  const view = await mount(tree('/docs', h(HookLayout, null, h('p', null, 'Page'))));
  try {
    await settle();
    const c = view.container;
    assert.equal(c.querySelector('[data-layout]').getAttribute('data-layout'), 'sidebar');
    const slotted = runtime().modules.flatMap((module) => module.views.map((view) => view.slot));
    assert.deepEqual(
      texts(c.querySelectorAll('[data-contribution]')).sort(),
      ['profile', 'search', 'workspace'],
      `every slot contribution (${slotted.join(', ')})`,
    );
    const actions = Object.values(runtime().actions.getState().actions)
      .filter((action) =>
        action.groups?.some((group) => ['navigation', 'admin'].includes(group.id)),
      )
      .map((action) => action.title);
    assert.deepEqual(
      [...new Set(texts(c.querySelectorAll('nav a, nav button')))].sort(),
      [...new Set(actions)].sort(),
      'every navigation action',
    );
    assert.equal(link(c, 'Docs').getAttribute('aria-current'), 'page');
    await act(() => runtime().settings.set('shell.layout', 'navbar'));
    assert.equal(c.querySelector('[data-layout]').getAttribute('data-layout'), 'navbar');
  } finally {
    await view.unmount();
  }
});

test('components replace parts; explicit children compose the parts themselves', async () => {
  function CustomSidebar({ groups, header }) {
    return h('aside', { 'data-custom-sidebar': groups.join(',') }, header);
  }
  function CustomItem({ item, active, layout }) {
    return h(
      'a',
      { href: item.href, 'data-custom-item': layout, 'data-on': active || undefined },
      item.title,
    );
  }
  const components = { Sidebar: CustomSidebar, NavigationItem: CustomItem };
  const { tree, runtime } = setup();
  const view = await mount(
    tree('/docs', h(AppShell, { components, brand: 'Brand' }, h('p', { 'data-page': '' }))),
  );
  try {
    await settle();
    const c = view.container;
    assert.equal(
      c.querySelector('[data-custom-sidebar]').getAttribute('data-custom-sidebar'),
      'navigation,admin',
    );
    assert.equal(c.querySelector('[data-custom-sidebar]').textContent, 'Brand');
    assert.equal(c.querySelector('[data-slot="sidebar"]'), null);
    assert.ok(
      c.querySelector('main header [data-slot="sidebar-trigger"]'),
      'the default top bar stays',
    );
    await act(() => runtime().settings.set('shell.layout', 'navbar'));
    const items = c.querySelectorAll('[data-custom-item="navbar"]');
    assert.deepEqual(texts(items), ['Home', 'Docs', 'Status', 'Refresh', 'Users']);
    assert.equal(c.querySelector('[data-custom-item][data-on]').textContent, 'Docs');

    await act(() => runtime().settings.set('shell.layout', 'sidebar'));
    await view.render(
      tree(
        '/docs',
        h(
          AppShell,
          null,
          h(AppShell.Sidebar, { header: 'Explicit brand' }),
          h(AppShell.Content, null, h('p', { 'data-page': '' }, 'Page')),
        ),
      ),
    );
    assert.equal(
      c.querySelector('[data-slot="sidebar-header"]').textContent,
      'Explicit brandworkspace',
    );
    assert.equal(c.querySelector('main header'), null, 'no top bar unless composed');
    assert.ok(c.querySelector('main [data-page]'));
    assert.equal(c.querySelectorAll('[data-slot="sidebar"]').length, 1);

    // A hand-written frame: the parts read their data from the hooks.
    await view.render(
      tree(
        '/docs',
        h(
          SidebarProvider,
          null,
          h(AppShell.Sidebar, { footer: 'Footer' }),
          h(
            AppShell.Content,
            { topBar: h(AppShell.TopBar, { header: 'Title' }) },
            h('p', null, 'Page'),
          ),
        ),
      ),
    );
    assert.ok(link(c.querySelector('[data-slot="sidebar"]'), 'Users'));
    assert.match(c.querySelector('main header').textContent, /Title/);
    assert.equal(c.querySelector('[data-slot="sidebar-footer"]').textContent, 'profileFooter');
  } finally {
    await view.unmount();
  }
});

test('AppShell explains a missing Shell plugin', async () => {
  class Boundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
      return { error };
    }
    render() {
      return this.state.error
        ? h('p', { role: 'alert' }, this.state.error.message)
        : this.props.children;
    }
  }
  function Layout() {
    return useShellLayout();
  }
  const { tree } = setup({ plugins: [tools] });
  const original = console.error;
  console.error = () => {};
  try {
    const view = await mount(tree('/docs', h(Boundary, null, h(Layout))));
    assert.match(
      view.container.querySelector('[role="alert"]').textContent,
      /AppShell needs the Shell plugin/,
    );
    await view.unmount();
  } finally {
    console.error = original;
  }
});
