import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { installDom, mount, click, testUI } from './support.mjs';
import { ActionProvider, useActionGroups, useActionGroup } from '../dist/actions/index.js';
import { ActionGroup, createActionList } from '@bitakit/core';
import { ActionMenu, FoundationProvider, useFoundation } from '../dist/index.js';
import { defineAction, definePlugin } from '@bitakit/core';

installDom();

const allowed = { id: 'alice', role: 'member', allowed: true };
const denied = { id: 'bob', role: 'member', allowed: false };
const owner = { id: 'carol', role: 'owner', allowed: true };

/** Renders bound groups as sections of buttons so ordering, state and titles are observable. */
function GroupView({ groups, input, name }) {
  const bound = useActionGroups(groups, input);
  return h(
    'div',
    { 'data-view': name },
    bound.map((group) =>
      h(
        'section',
        { key: group.id, 'data-group': group.id, 'aria-label': group.title },
        group.items.map((item) =>
          h('button', { key: item.id, 'data-action': item.id, ...item.props() }, item.title),
        ),
      ),
    ),
  );
}

test('groups are ordered, bound to the caller input, titled and free of internal and hidden actions', async () => {
  const received = [];
  const config = {
    groups: ['members'],
    plugins: [
      definePlugin({
        id: 'team',
        actions: {
          promote: defineAction({
            title: 'Promote',
            tooltip: 'Admin rights',
            groups: ['members'],
            order: 20,
            enabled: ({ input }) => input?.allowed === true,
            visible: ({ input }) => input?.role === 'member',
            execute: ({ input }) => received.push(input.id),
          }),
          remove: defineAction({ title: 'Remove', groups: ['members'], order: 10, execute() {} }),
          helper: defineAction({
            title: 'Helper',
            groups: ['members'],
            internal: true,
            execute: () => 'ran',
          }),
          home: defineAction({ title: 'Home', href: '/', groups: ['navigation'] }),
          export: defineAction({
            title: 'Export',
            groups: [new ActionGroup('team.bulk', 'Bulk actions')],
            execute() {},
          }),
        },
      }),
    ],
  };
  let runtime;
  function Capture() {
    runtime = useFoundation().runtime;
    return null;
  }
  const single = {};
  function Single({ group, input }) {
    single.value = useActionGroup(group, input);
    return null;
  }
  const view = await mount(
    h(
      FoundationProvider,
      { config, ui: testUI },
      h(Capture),
      h(GroupView, { name: 'allowed', groups: ['members'], input: allowed }),
      h(GroupView, { name: 'denied', groups: ['members'], input: denied }),
      h(GroupView, {
        name: 'owner',
        groups: ['members', 'navigation', 'team.bulk', 'empty'],
        input: owner,
      }),
      h(GroupView, {
        name: 'titled',
        groups: [new ActionGroup('members', 'Team members')],
        input: allowed,
      }),
      h(Single, { group: 'empty' }),
    ),
  );
  const buttons = (name) => [...view.container.querySelectorAll(`[data-view="${name}"] button`)];
  const sections = (name) => [...view.container.querySelectorAll(`[data-view="${name}"] section`)];
  try {
    assert.deepEqual(
      buttons('allowed').map((button) => [button.dataset.action, button.disabled, button.title]),
      [
        ['team.remove', false, ''],
        ['team.promote', false, 'Admin rights'],
      ],
      'items follow order, internal helpers stay out',
    );
    assert.equal(buttons('denied')[1].disabled, true, 'enabled is resolved for the caller input');
    assert.deepEqual(
      sections('owner').map((section) => [
        section.dataset.group,
        section.getAttribute('aria-label'),
        section.querySelectorAll('button').length,
      ]),
      [
        ['members', 'members', 1],
        ['navigation', 'General', 1],
        ['team.bulk', 'Bulk actions', 1],
      ],
      'hidden items are dropped, empty groups disappear, titles come from the group or the default',
    );
    assert.equal(
      sections('titled')[0].getAttribute('aria-label'),
      'Team members',
      'a titled group object names the heading',
    );
    await click(buttons('allowed')[1]);
    assert.deepEqual(received, ['alice'], 'items execute with the input they were bound to');
    assert.deepEqual(await runtime.actions.execute('team.promote', denied), {
      status: 'skipped',
      reason: 'disabled',
    });
    assert.deepEqual(
      single.value,
      { id: 'empty', title: 'empty', items: [] },
      'an empty group keeps its shape',
    );
    await act(async () => {
      assert.deepEqual(
        await runtime.actions.execute('team.helper'),
        { status: 'completed', value: 'ran' },
        'internal actions still execute by ID',
      );
    });
    await act(async () => {
      runtime.actions.update('team.promote', { title: 'Make admin' });
    });
    assert.equal(buttons('allowed')[1].textContent, 'Make admin');
    let extra;
    await act(async () => {
      extra = runtime.actions.register({
        id: 'extra',
        title: 'Extra',
        order: 15,
        groups: [new ActionGroup('members')],
        execute() {},
      });
    });
    assert.deepEqual(
      buttons('allowed').map((button) => button.dataset.action),
      ['team.remove', 'extra', 'team.promote'],
      'registrations join their group in order without remounting',
    );
    await act(async () => extra.unregister());
    assert.deepEqual(
      buttons('allowed').map((button) => button.dataset.action),
      ['team.remove', 'team.promote'],
    );
  } finally {
    await view.unmount();
  }
});

test('group members react to service state through function-valued presentation', async () => {
  const { useServiceState } = await import('../dist/index.js');
  const { defineService } = await import('@bitakit/core');
  const config = {
    plugins: [
      definePlugin({
        id: 'todos',
        services: {
          items: defineService(({ store }) => {
            const state = store({ items: [] });
            return {
              state,
              add: (title) => state.set((current) => ({ items: [...current.items, title] })),
            };
          }),
        },
        actions: {
          clear: defineAction({
            title: ({ services }) => `Clear ${services.todos.items.state.get().items.length}`,
            groups: ['todos.toolbar'],
            enabled: ({ services }) => services.todos.items.state.get().items.length > 0,
            execute: ({ services }) => services.todos.items.state.set({ items: [] }),
          }),
        },
      }),
    ],
  };
  let runtime;
  function Capture() {
    runtime = useFoundation().runtime;
    const count = useServiceState('todos.items', (state) => state.items.length, 0);
    return h('output', null, count);
  }
  const view = await mount(
    h(
      FoundationProvider,
      { config, ui: testUI },
      h(Capture),
      h(GroupView, { name: 'toolbar', groups: ['todos.toolbar'] }),
    ),
  );
  const button = () => view.container.querySelector('[data-action="todos.clear"]');
  try {
    assert.equal(button().disabled, true);
    assert.equal(button().textContent, 'Clear 0');
    await act(async () => runtime.services.todos.items.add('Milk'));
    assert.equal(button().disabled, false);
    assert.equal(button().textContent, 'Clear 1');
    assert.equal(view.container.querySelector('output').textContent, '1');
    await click(button());
    assert.equal(button().disabled, true);
    assert.equal(view.container.querySelector('output').textContent, '0');
  } finally {
    await view.unmount();
  }
});

test('ActionMenu hands bound groups and the label to the host menu component', async () => {
  const seen = [];
  const Menu = (props) => {
    seen.push(props);
    return testUI.Menu(props);
  };
  const executed = [];
  const config = {
    groups: ['members'],
    plugins: [
      definePlugin({
        id: 'team',
        actions: {
          promote: defineAction({
            title: 'Promote',
            groups: ['members'],
            enabled: ({ input }) => input?.allowed === true,
            execute: ({ input }) => executed.push(input.id),
          }),
          leave: defineAction({ title: 'Leave', groups: ['account'], execute() {} }),
        },
      }),
    ],
  };
  const view = await mount(
    h(
      FoundationProvider,
      { config, ui: { ...testUI, Menu } },
      h(ActionMenu, { group: 'members', label: 'Team', input: allowed }),
      h(ActionMenu, { group: ['members', 'account'], label: 'More', input: denied }),
    ),
  );
  try {
    const [team, more] = [...view.container.querySelectorAll('nav')];
    assert.equal(team.getAttribute('aria-label'), 'Team');
    // The first render happens before the runtime mounts; the menu receives the bound groups afterwards.
    const latest = seen.findLast((props) => props.label === 'Team');
    assert.deepEqual(
      latest.groups.map((group) => group.id),
      ['members'],
    );
    assert.equal(latest.groups[0].items[0].title, 'Promote');
    assert.equal(
      typeof latest.groups[0].items[0].menuItemProps,
      'function',
      'items are controls with getters',
    );
    assert.deepEqual(
      [...more.querySelectorAll('section')].map((section) => section.dataset.group),
      ['members', 'account'],
    );
    assert.equal(
      more.querySelector('[data-group="members"] button').disabled,
      true,
      'the menu input binds every item',
    );
    await click(team.querySelector('button'));
    assert.deepEqual(executed, ['alice']);
  } finally {
    await view.unmount();
  }
});

test('the standard menu renders a trigger with the label and keeps items closed until opened', async () => {
  const list = createActionList([
    { id: 'save', title: 'Save', groups: [new ActionGroup('file')], execute() {} },
  ]);
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(FoundationProvider, { config: {} }, h(ActionMenu, { group: 'file', label: 'File' })),
    ),
  );
  try {
    const trigger = view.container.querySelector('button');
    assert.equal(trigger.textContent, 'File');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(view.container.querySelector('[role="menuitem"]'), null);
  } finally {
    await view.unmount();
  }
});
