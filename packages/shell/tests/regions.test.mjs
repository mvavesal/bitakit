import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { mount, click, settle } from './support.mjs';
import { createRuntime, inspectRuntime } from '@bitakit/core';
import {
  defineAction,
  definePlugin,
  createMemorySettingsStorage,
} from '@bitakit/ui';
import {
  AppShell,
  ErrorPage,
  shellPlugin,
  shellSlots,
  ShellDrawer,
  ShellFullPage,
  ShellHeaderRow,
  ShellSurface,
} from '../dist/index.js';
import { FoundationProvider } from '@bitakit/ui';

const widget = (name) => ({ payload }) =>
  h('span', { 'data-region': name, 'data-context': JSON.stringify(payload ?? {}) }, name);

function host(children, plugins = []) {
  return h(
    FoundationProvider,
    {
      config: { plugins: [shellPlugin(), ...plugins] },
      services: {
        'settings.storage': createMemorySettingsStorage({ 'shell.layout': 'sidebar' }),
      },
    },
    children,
  );
}

test('new shell region contracts preserve legacy slot IDs and scope header rows by rowId', async () => {
  assert.equal(shellSlots.appBar.id, 'app-bar.end');
  assert.equal(shellSlots.header.id, 'sidebar.header');
  assert.equal(shellSlots.footer.id, 'sidebar.footer');
  assert.equal(shellSlots.pageFooter.id, 'shell.footer');

  const regions = definePlugin({
    id: 'row-widgets',
    ui: {
      slots: [
        {
          slot: 'shell.header.row.start',
          when: ({ payload }) => payload.rowId === 'primary',
          component: widget('primary-start'),
        },
        {
          slot: 'shell.header.row.end',
          when: ({ payload }) => payload.rowId === 'secondary',
          component: widget('secondary-end'),
        },
      ],
    },
  });
  const view = await mount(
    host(
      h('div', null, h(ShellHeaderRow, { id: 'primary' }), h(ShellHeaderRow, { id: 'secondary' })),
      [regions],
    ),
  );
  try {
    await settle();
    const primary = view.container.querySelector('[data-shell-row="primary"]');
    const secondary = view.container.querySelector('[data-shell-row="secondary"]');
    assert.equal(primary.querySelector('[data-region="primary-start"]')?.textContent, 'primary-start');
    assert.equal(primary.querySelector('[data-region="secondary-end"]'), null);
    assert.equal(secondary.querySelector('[data-region="secondary-end"]')?.textContent, 'secondary-end');
    assert.equal(secondary.querySelector('[data-region="primary-start"]'), null);
  } finally {
    await view.unmount();
  }
});

test('built Shell slot metadata matches runtime inventory IDs, kinds, accepts, and policies', async () => {
  const metadata = JSON.parse(
    await readFile(new URL('../dist/foundation.slots.json', import.meta.url), 'utf8'),
  );
  const runtime = createRuntime({ plugins: [shellPlugin()] });
  const inventory = inspectRuntime(runtime);
  const plugin = inventory.static.plugins.find((entry) => entry.id === 'shell');
  const declarations = plugin.declarations.filter((entry) => entry.kind === 'slot');
  const runtimeDefinitions = runtime.modules.find((module) => module.id === 'shell').slots;
  assert.equal(metadata.version, 1);
  assert.deepEqual(
    metadata.definitions.map((entry) => entry.id).sort(),
    declarations.map((entry) => entry.id).sort(),
  );
  for (const entry of metadata.definitions) {
    assert.equal(entry.plugin, 'shell');
    assert.equal(entry.file, 'src/slots.ts');
    assert.equal(entry.accepts, runtimeDefinitions.find((slot) => slot.id === entry.id).accepts);
    assert.equal(entry.policy, runtimeDefinitions.find((slot) => slot.id === entry.id).policy);
    assert.equal(declarations.find((declaration) => declaration.id === entry.id).kind, 'slot');
  }
});

test('drawer regions select their own drawerId across header, body, and footer', async () => {
  const slots = ['header', 'body', 'footer'].flatMap((region) =>
    ['account', 'help'].map((drawerId) => ({
      slot: `shell.drawer.${region}`,
      when: ({ payload }) => payload.drawerId === drawerId,
      component: widget(`${drawerId}-${region}`),
    })),
  );
  const contributor = definePlugin({ id: 'drawer-widgets', ui: { slots } });
  const drawer = (id) =>
    h(ShellDrawer, {
      id,
      title: `${id} drawer`,
      trigger: h('button', null, `Open ${id}`),
      open: true,
      footer: h('span', null, `Host ${id} footer`),
    });
  const view = await mount(host(h('div', null, drawer('account'), drawer('help')), [contributor]));
  try {
    await settle();
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const account = dialogs.find((dialog) => dialog.textContent.includes('account drawer'));
    const help = dialogs.find((dialog) => dialog.textContent.includes('help drawer'));
    assert.ok(account);
    assert.ok(help);
    for (const region of ['header', 'body', 'footer']) {
      assert.ok(account.querySelector(`[data-region="account-${region}"]`));
      assert.equal(account.querySelector(`[data-region="help-${region}"]`), null);
      assert.ok(help.querySelector(`[data-region="help-${region}"]`));
      assert.equal(help.querySelector(`[data-region="account-${region}"]`), null);
    }
  } finally {
    await view.unmount();
  }
});

test('full-page and framed surfaces share content regions and render children exactly once', async () => {
  let childRenders = 0;
  const contribution = definePlugin({
    id: 'surface-widgets',
    ui: {
      slots: [
        { slot: 'shell.content.before', component: widget('before') },
        { slot: 'shell.content.after', component: widget('after') },
      ],
    },
  });
  function Child({ name }) {
    childRenders++;
    return h('p', { 'data-surface-child': name }, name);
  }
  const view = await mount(
    host(
      h(
        'div',
        null,
        h(ShellSurface, null, h(Child, { name: 'surface' })),
        h(ShellFullPage, { surface: AppShell.Surface }, h(Child, { name: 'full-page' })),
      ),
      [contribution],
    ),
  );
  try {
    await settle();
    assert.equal(view.container.querySelectorAll('[data-shell-surface]').length, 2);
    assert.equal(view.container.querySelectorAll('[data-surface-child]').length, 2);
    assert.equal(childRenders, 2);
    for (const surface of view.container.querySelectorAll('[data-shell-surface]')) {
      assert.equal(surface.querySelectorAll('[data-region="before"]').length, 1);
      assert.equal(surface.querySelectorAll('[data-region="after"]').length, 1);
    }
  } finally {
    await view.unmount();
  }
});

test('navigation group regions are filtered independently by groupId', async () => {
  const contributor = definePlugin({
    id: 'navigation-groups',
    actions: {
      account: defineAction({ title: 'Account', href: '/account', slots: ['shell.navigation'] }),
      reports: defineAction({ title: 'Reports', href: '/reports', slots: ['shell.navigation'] }),
    },
    ui: {
      slots: ['before', 'after'].flatMap((region) =>
        ['account', 'reports'].map((groupId) => ({
          slot: `shell.navigation.group.${region}`,
          when: ({ payload }) => payload.groupId === groupId,
          component: widget(`${groupId}-${region}`),
        })),
      ),
    },
  });
  const view = await mount(
    host(
      h(
        AppShell,
        null,
        h(AppShell.NavigationGroup, { id: 'account', title: 'Account group', navigationSlot: 'shell.navigation' }),
        h(AppShell.NavigationGroup, { id: 'reports', title: 'Reports group', navigationSlot: 'shell.navigation' }),
      ),
      [contributor],
    ),
  );
  try {
    await settle();
    const groups = [...view.container.querySelectorAll('[data-slot="sidebar-group"]')];
    const account = groups.find((group) => group.textContent.includes('Account group'));
    const reports = groups.find((group) => group.textContent.includes('Reports group'));
    assert.ok(account);
    assert.ok(reports);
    for (const region of ['before', 'after']) {
      assert.ok(account.querySelector(`[data-region="account-${region}"]`));
      assert.equal(account.querySelector(`[data-region="reports-${region}"]`), null);
      assert.ok(reports.querySelector(`[data-region="reports-${region}"]`));
      assert.equal(reports.querySelector(`[data-region="account-${region}"]`), null);
    }
  } finally {
    await view.unmount();
  }
});

test('ErrorPage catches a crashing state contribution and keeps host reset available', async () => {
  const broken = definePlugin({
    id: 'state-widget',
    ui: {
      slots: [
        {
          slot: 'shell.state.content',
          key: 'failure',
          component: () => {
            throw new Error('private slot crash');
          },
        },
      ],
    },
  });
  let resets = 0;
  const original = console.error;
  console.error = () => {};
  let view;
  try {
    view = await mount(host(h(ErrorPage, { surfaceId: 'failure', reset: () => resets++ }), [broken]));
    await settle();
    assert.match(view.container.textContent, /Something went wrong/);
    assert.doesNotMatch(view.container.textContent, /private slot crash/);
    const reset = view.container.querySelector('button');
    assert.ok(reset, 'the host ErrorPage reset remains available outside slot content');
    await click(reset);
    assert.equal(resets, 1);
  } finally {
    if (view) await view.unmount();
    console.error = original;
  }
});
