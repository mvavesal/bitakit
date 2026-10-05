import { mount, renderApp, click, tick, testUI } from './support.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { act, createElement as h } from 'react';
import {
  createRuntime,
  inspectRuntime,
  createTranslationPlugin,
  defineAction,
  definePlugin,
  defineService,
  defineSettings,
  setting,
} from '@bitakit/core';
import { FoundationProvider, useFoundation, useServiceState } from '@bitakit/ui';
import { appPreferencesPlugin } from '../dist/foundation.js';
import { SettingsPage, SettingsNavigation, SettingsShell } from '../dist/index.js';
import { SettingsLocationContext } from '../dist/components/location.js';

const pagePlugin = definePlugin({
  id: 'billing',
  settings: defineSettings({ note: setting({ default: '', label: 'Note' }) }),
  ui: {
    settings: {
      pages: [{ id: 'history', title: 'History', component: () => h('p', null, 'History body') }],
    },
  },
});
const widget = (id, order) =>
  definePlugin({
    id,
    ui: {
      slots: [
        {
          slot: 'app-preferences.page.after',
          order,
          when: ({ payload }) => payload.pageId === 'billing/history',
          component: ({ payload }) => h('p', { 'data-extension': id }, `${id}:${payload.pageId}`),
        },
      ],
    },
  });

test('one catalog projects keyed bodies and existing navigation Actions, updates labels and releases everything', async () => {
  let title = 'Billing';
  const translation = createTranslationPlugin((key) =>
    key === 'billing.settings.title' ? title : key,
  );
  const runtime = createRuntime({ plugins: [translation, appPreferencesPlugin(), pagePlugin] });
  const stop = runtime.mount();
  await runtime.ready;
  const bodies = () => runtime.slots.get('app-preferences.page.body').items;
  const nav = () => runtime.slots.get('app-preferences.navigation').items;
  try {
    assert.deepEqual(
      bodies()
        .map((x) => x.key)
        .sort(),
      ['app-preferences', 'billing', 'billing/history'],
    );
    assert.equal(nav().length, 3);
    const before = bodies().find((x) => x.key === 'billing');
    title = 'Rechnungen';
    translation.update((key) => (key === 'billing.settings.title' ? title : key));
    assert.equal(runtime.actions.resolve('settings.section.billing').title, 'Rechnungen');
    assert.equal(
      bodies().find((x) => x.key === 'billing'),
      before,
      'translation preserves body identity',
    );
    assert.equal(nav().length, 3, 'translation does not append placements');
  } finally {
    await stop();
  }
  assert.equal(bodies().length, 0);
  assert.equal(nav().length, 0);
  assert.equal(runtime.actions.get('settings.section.billing'), undefined);
});

test('two page outlets select their own body, ordered extensions and contextual toolbar input', async () => {
  const calls = [];
  const command = definePlugin({
    id: 'audit',
    actions: {
      export: defineAction({
        title: 'Export history',
        slots: [{ name: 'app-preferences.page.toolbar', input: ({ payload }) => payload.pageId }],
        visible: ({ input }) => input === 'billing/history',
        execute: ({ input }) => calls.push(input),
      }),
    },
  });
  const view = await renderApp(
    h(
      'div',
      null,
      h('section', { 'data-page': 'main' }, h(SettingsPage, { pathname: '/settings/billing' })),
      h(
        'section',
        { 'data-page': 'extra' },
        h(SettingsPage, { pathname: '/settings/billing/history' }),
      ),
    ),
    {
      config: {
        plugins: [
          appPreferencesPlugin(),
          pagePlugin,
          widget('late', 40),
          widget('early', 20),
          command,
        ],
      },
    },
  );
  try {
    await act(tick);
    const main = view.container.querySelector('[data-page=main]'),
      extra = view.container.querySelector('[data-page=extra]');
    assert.ok(main.querySelector('[data-setting="billing.note"]'));
    assert.equal(main.querySelector('[data-extension]'), null);
    assert.equal(main.querySelector('button'), null);
    assert.match(extra.textContent, /History body/);
    assert.equal(extra.querySelector('[data-setting]'), null);
    assert.deepEqual(
      [...extra.querySelectorAll('[data-extension]')].map((x) => x.dataset.extension),
      ['early', 'late'],
    );
    await click(extra.querySelector('button'));
    assert.deepEqual(calls, ['billing/history']);
  } finally {
    await view.unmount();
  }
});

test('page boundaries enclose body, toolbar and extensions; removed sources leave no stale projection', async () => {
  let runtime,
    mounted = 0;
  function Boundary({ children }) {
    const allowed = useServiceState('access', (state) => state, false);
    return allowed ? children : h('p', null, 'Access denied');
  }
  const guarded = definePlugin({
    id: 'secure',
    ui: {
      settings: {
        component: () => h('p', null, 'Secret body'),
        boundary: Boundary,
      },
    },
  });
  const extension = definePlugin({
    id: 'extension',
    ui: {
      slots: [
        {
          slot: 'app-preferences.page.after',
          when: ({ payload }) => payload.pageId === 'secure',
          component: () => {
            mounted++;
            return h('p', { 'data-secret-extension': true }, 'Secret extension');
          },
        },
      ],
    },
    actions: {
      run: defineAction({
        title: 'Secret command',
        slots: ['app-preferences.page.toolbar'],
        execute() {},
      }),
    },
  });
  const base = { services: { access: defineService(({ store }) => ({ state: store(false) })) } };
  function Probe() {
    runtime = useFoundation().runtime;
    return h(SettingsPage, { pathname: '/settings/secure' });
  }
  const tree = (plugins) => h(FoundationProvider, { config: { ...base, plugins } }, h(Probe));
  const preferences = appPreferencesPlugin();
  const view = await mount(tree([preferences, guarded, extension]));
  try {
    assert.match(view.container.textContent, /Access denied/);
    assert.equal(mounted, 0);
    assert.equal(view.container.querySelector('button'), null);
    await act(() => runtime.services.access.state.set(true));
    await act(tick);
    assert.match(view.container.textContent, /Secret body/);
    assert.ok(mounted > 0);
    await act(() => runtime.services.access.state.set(false));
    assert.equal(view.container.querySelector('[data-secret-extension]'), null);
    await view.render(tree([preferences]));
    await act(tick);
    assert.match(view.container.textContent, /not available/);
    assert.equal(runtime.actions.get('settings.section.secure'), undefined);
    assert.equal(
      runtime.slots.get('app-preferences.page.body').items.some((x) => x.key === 'secure'),
      false,
    );
  } finally {
    await view.unmount();
  }
});

test('explicit navigation links and sidebar widgets share the existing Settings shell', async () => {
  function RouterLink(props) {
    assert.equal(typeof props.href, 'string', 'router links require a valid href');
    return h('a', props);
  }
  const extra = definePlugin({
    id: 'help',
    actions: {
      open: defineAction({ title: 'Help', href: '/help', slots: ['app-preferences.navigation'] }),
      groupOnly: defineAction({ title: 'Not placed', href: '/hidden', groups: ['settings.pages'] }),
      disabled: defineAction({
        title: 'Locked',
        href: '/locked',
        enabled: false,
        slots: ['app-preferences.navigation'],
      }),
    },
    ui: {
      slots: [
        {
          slot: 'app-preferences.navigation.footer',
          component: () => h('p', null, 'Support widget'),
        },
      ],
    },
  });
  const view = await renderApp(
    h(
      SettingsLocationContext.Provider,
      { value: { Link: RouterLink } },
      h(SettingsShell, { pathname: '/settings/billing' }, 'Content'),
    ),
    { config: { plugins: [appPreferencesPlugin(), pagePlugin, extra] } },
  );
  try {
    assert.ok(view.container.querySelector('a[href="/help"]'));
    assert.equal(view.container.querySelector('a[href="/hidden"]'), null);
    const locked = [...view.container.querySelectorAll('a')].find(
      (x) => x.textContent === 'Locked',
    );
    assert.equal(locked.getAttribute('href'), null);
    assert.equal(locked.getAttribute('aria-disabled'), 'true');
    assert.match(view.container.textContent, /Support widget/);
  } finally {
    await view.unmount();
  }
});

test('render failures in a settings body and extension stay isolated from sibling extensions and navigation', async () => {
  const badPage = definePlugin({
    id: 'crashing',
    ui: {
      settings: {
        pages: [
          {
            id: 'details',
            title: 'Crash page',
            component: () => {
              throw new Error('body exploded');
            },
          },
        ],
      },
    },
  });
  const badExtension = definePlugin({
    id: 'bad-extension',
    ui: {
      slots: [
        {
          slot: 'app-preferences.page.after',
          when: ({ payload }) => payload.pageId === 'crashing/details',
          component: () => {
            throw new Error('extension exploded');
          },
        },
      ],
    },
  });
  const goodExtension = definePlugin({
    id: 'good-extension',
    ui: {
      slots: [
        {
          slot: 'app-preferences.page.after',
          when: ({ payload }) => payload.pageId === 'crashing/details',
          component: () => h('p', { 'data-good-extension': true }, 'Healthy extension'),
        },
      ],
    },
  });
  let runtime;
  function Capture() {
    runtime = useFoundation().runtime;
    return null;
  }
  const original = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  let view;
  try {
    view = await renderApp(
      h('div', null, h(Capture), h(SettingsPage, { pathname: '/settings/crashing/details' })),
      {
        config: { plugins: [appPreferencesPlugin(), badPage, badExtension, goodExtension] },
      },
    );
    assert.match(view.container.textContent, /Healthy extension/);
    assert.equal(view.container.querySelectorAll('[role="alert"]').length, 2);
    assert.equal(
      view.container.querySelector('[data-good-extension]')?.textContent,
      'Healthy extension',
    );
    assert.ok(
      view.container.querySelector(
        '[role="alert"][data-slot-plugin="crashing"][data-slot-contribution="crashing/details"]',
      ),
      'custom settings body errors identify their plugin and page section',
    );
    assert.ok(view.container.querySelector('[role="alert"][data-slot-plugin="bad-extension"]'));
    const sectionAction = runtime.actions.resolve('settings.section.crashing/details');
    assert.ok(sectionAction, 'the page navigation Action remains registered while its body fails');
  } finally {
    if (view) await view.unmount();
    console.error = original;
  }
  assert.ok(errors.some((message) => message.includes('body exploded')));
  assert.ok(errors.some((message) => message.includes('extension exploded')));
});

test('settings access boundaries hide failed bodies and extension fallbacks, including on revocation', async () => {
  function AccessBoundary({ children }) {
    const allowed = useServiceState('access', (state) => state, false);
    return allowed ? children : h('p', null, 'Access denied');
  }
  const guardedPage = definePlugin({
    id: 'private-page',
    ui: {
      settings: {
        component: () => {
          throw new Error('private body');
        },
        boundary: AccessBoundary,
      },
    },
  });
  const crashingExtension = definePlugin({
    id: 'private-extension',
    ui: {
      slots: [
        ...['header', 'before', 'footer'].map((region) => ({
          slot: `app-preferences.page.${region}`,
          when: ({ payload }) => payload.pageId === 'private-page',
          component: () => h('p', { 'data-private-region': region }, `Private ${region}`),
        })),
        {
          slot: 'app-preferences.page.after',
          when: ({ payload }) => payload.pageId === 'private-page',
          component: () => {
            throw new Error('private extension');
          },
        },
      ],
    },
  });
  const base = { services: { access: defineService(({ store }) => ({ state: store(false) })) } };
  let runtime;
  function Capture() {
    runtime = useFoundation().runtime;
    return null;
  }
  const original = console.error;
  console.error = () => {};
  let view;
  try {
    view = await mount(
      h(
        FoundationProvider,
        {
          config: { ...base, plugins: [appPreferencesPlugin(), guardedPage, crashingExtension] },
          ui: testUI,
        },
        h(Capture),
        h(SettingsPage, { pathname: '/settings/private-page' }),
      ),
    );
    assert.match(view.container.textContent, /Access denied/);
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    assert.equal(view.container.querySelector('[data-private-region]'), null);
    await act(() => runtime.services.access.state.set(true));
    await act(tick);
    assert.equal(view.container.querySelectorAll('[role="alert"]').length, 2);
    assert.deepEqual(
      [...view.container.querySelectorAll('[data-private-region]')].map((node) => node.dataset.privateRegion),
      ['header', 'before', 'footer'],
    );
    await act(() => runtime.services.access.state.set(false));
    await act(tick);
    assert.match(view.container.textContent, /Access denied/);
    assert.equal(
      view.container.querySelector('[role="alert"]'),
      null,
      'revoking access removes rendered fallbacks',
    );
    assert.equal(
      view.container.querySelector('[data-private-region]'),
      null,
      'revoking access removes all page extension regions',
    );
  } finally {
    if (view) await view.unmount();
    console.error = original;
  }
});

test('settings navigation header and group regions receive scoped group IDs, with page regions scoped by pageId', async () => {
  const extension = definePlugin({
    id: 'region-widgets',
    ui: {
      slots: [
        {
          slot: 'app-preferences.navigation.header',
          component: () => h('p', { 'data-nav-header': true }, 'Navigation header'),
        },
        ...['before', 'after'].map((region) => ({
          slot: `app-preferences.navigation.group.${region}`,
          when: ({ payload }) => payload.groupId === 'plugins',
          component: ({ payload }) =>
            h('p', { [`data-group-${region}`]: payload.groupId }, `${region}:${payload.groupId}`),
        })),
        ...['header', 'before', 'footer'].map((region) => ({
          slot: `app-preferences.page.${region}`,
          when: ({ payload }) => payload.pageId === 'billing/history',
          component: ({ payload }) =>
            h('p', { [`data-page-${region}`]: payload.pageId }, `${region}:${payload.pageId}`),
        })),
      ],
    },
  });
  const view = await renderApp(
    h(
      SettingsShell,
      { pathname: '/settings/billing/history' },
      h(SettingsPage, { pathname: '/settings/billing/history' }),
    ),
    { config: { plugins: [appPreferencesPlugin(), pagePlugin, extension] } },
  );
  try {
    assert.equal(view.container.querySelector('[data-nav-header]')?.textContent, 'Navigation header');
    assert.equal(view.container.querySelector('[data-group-before="plugins"]')?.textContent, 'before:plugins');
    assert.equal(view.container.querySelector('[data-group-after="plugins"]')?.textContent, 'after:plugins');
    for (const region of ['header', 'before', 'footer'])
      assert.equal(
        view.container.querySelector(`[data-page-${region}="billing/history"]`)?.textContent,
        `${region}:billing/history`,
      );
  } finally {
    await view.unmount();
  }
});

test('built App Preferences slot metadata matches runtime inventory IDs, kinds, accepts, and policies', async () => {
  const metadata = JSON.parse(
    await readFile(new URL('../dist/foundation.slots.json', import.meta.url), 'utf8'),
  );
  const runtime = createRuntime({ plugins: [appPreferencesPlugin()] });
  const inventory = inspectRuntime(runtime);
  const plugin = inventory.static.plugins.find((entry) => entry.id === 'app-preferences');
  const declarations = plugin.declarations.filter((entry) => entry.kind === 'slot');
  const runtimeDefinitions = runtime.modules.find((module) => module.id === 'app-preferences').slots;
  assert.equal(metadata.version, 1);
  assert.deepEqual(
    metadata.definitions.map((entry) => entry.id).sort(),
    declarations.map((entry) => entry.id).sort(),
  );
  for (const entry of metadata.definitions) {
    assert.equal(entry.plugin, 'app-preferences');
    assert.equal(entry.file, 'src/slots.ts');
    assert.equal(entry.accepts, runtimeDefinitions.find((slot) => slot.id === entry.id).accepts);
    assert.equal(entry.policy, runtimeDefinitions.find((slot) => slot.id === entry.id).policy);
    assert.equal(declarations.find((declaration) => declaration.id === entry.id).kind, 'slot');
  }
});
