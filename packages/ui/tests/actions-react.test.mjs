import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act, StrictMode, useEffect } from 'react';
import { installDom, mount, testUI } from './support.mjs';
import {
  ActionProvider,
  useAction,
  useActionList,
  useActions,
  useActionGroups,
  createActionList,
  ActionGroup,
  ActionButton,
} from '../dist/actions/index.js';
import {
  FoundationProvider,
  defineAction,
  definePlugin,
  defineService,
  useFoundation,
} from '../dist/index.js';

installDom();

/** Explicit runtime registration: the list stays the single registry, React only owns the lifetime. */
function Register({ definition }) {
  const list = useActionList();
  useEffect(() => list.register(definition).unregister, [list, definition]);
  return null;
}

test('React bindings share updates, while unrelated action subscribers do not re-render', async () => {
  const list = createActionList([
    { id: 'save', title: 'Save' },
    { id: 'other', title: 'Other' },
  ]);
  const renders = { first: 0, second: 0, other: 0 };
  function Bind({ id, name }) {
    const action = useAction(id);
    renders[name]++;
    return h('span', { 'data-name': name }, action?.title ?? 'missing');
  }
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(Bind, { id: 'save', name: 'first' }),
      h(Bind, { id: 'save', name: 'second' }),
      h(Bind, { id: 'other', name: 'other' }),
      h(Bind, { id: 'missing', name: 'missing' }),
    ),
  );
  try {
    assert.equal(view.container.querySelector('[data-name="missing"]').textContent, 'missing');
    const before = { ...renders };
    await act(async () => {
      list.update('save', { title: 'Publish' });
    });
    assert.equal(view.container.querySelector('[data-name="first"]').textContent, 'Publish');
    assert.equal(view.container.querySelector('[data-name="second"]').textContent, 'Publish');
    assert.equal(renders.other, before.other, 'a snapshot selector keeps unrelated controls quiet');
    assert.ok(renders.first > before.first && renders.second > before.second);
  } finally {
    await view.unmount();
  }
});

test('providers are isolated even with identical action IDs; registrations are released on unmount', async () => {
  const lists = {};
  function Capture({ name }) {
    lists[name] = useActionList();
    return null;
  }
  const definitions = [1, 2].map((n) => ({ id: 'save', title: `Save ${n}` }));
  const tree = (registered) =>
    h(
      StrictMode,
      null,
      ...[1, 2].map((n) =>
        h(
          ActionProvider,
          { key: n },
          h(Capture, { name: n }),
          registered ? h(Register, { definition: definitions[n - 1] }) : null,
        ),
      ),
    );
  const view = await mount(tree(true));
  try {
    const { 1: first, 2: second } = lists;
    assert.notEqual(first, second);
    assert.equal(first.get('save').title, 'Save 1');
    assert.equal(second.get('save').title, 'Save 2');
    await act(async () => {
      first.update('save', { enabled: false });
    });
    assert.equal(second.get('save').enabled, true);
    await view.render(tree(false));
    assert.equal(
      first.get('save'),
      undefined,
      'Strict Mode replay still leaves exactly one registration to release',
    );
    assert.equal(second.get('save'), undefined);
  } finally {
    await view.unmount();
  }
});

test('provider interceptors are optional, ordered and replaced without leaving old handlers', async () => {
  const calls = [];
  const list = createActionList([{ id: 'run', title: 'Run', execute: () => calls.push('run') }]);
  const first = { before: () => void calls.push('first') };
  const stop = {
    before() {
      calls.push('stop');
      return false;
    },
  };
  const tree = (interceptors) =>
    h(StrictMode, null, h(ActionProvider, { actions: list, interceptors }, null));
  const view = await mount(tree([first, stop]));
  try {
    await act(async () => {
      assert.equal((await list.execute('run')).reason, 'intercepted');
    });
    assert.deepEqual(calls, ['first', 'stop']);
    calls.length = 0;
    await view.render(tree(undefined));
    await act(async () => {
      await list.execute('run');
    });
    assert.deepEqual(calls, ['run']);
  } finally {
    await view.unmount();
  }
});

test('internal registrations stay executable but disappear from enumeration and groups', async () => {
  const group = new ActionGroup('menu');
  const list = createActionList([
    { id: 'public', title: 'Public', groups: [group] },
    { id: 'helper', title: 'Helper', groups: [group], internal: true, execute: () => 'ran' },
  ]);
  const seen = {};
  function Enumerate({ internal }) {
    seen[internal ? 'all' : 'public'] = Object.keys(
      useActions(internal ? { internal } : undefined),
    );
    return null;
  }
  function Menu() {
    const groups = useActionGroups([group]);
    return h(
      'div',
      null,
      ...groups.flatMap((entry) => entry.items.map((item) => h('span', { key: item.id }, item.id))),
    );
  }
  const view = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(Enumerate, { internal: false }),
      h(Enumerate, { internal: true }),
      h(Menu),
    ),
  );
  try {
    assert.deepEqual(seen.public, ['public']);
    assert.deepEqual(seen.all, ['public', 'helper']);
    assert.equal(view.container.textContent, 'public');
    await act(async () => {
      assert.deepEqual(await list.execute('helper'), { status: 'completed', value: 'ran' });
    });
  } finally {
    await view.unmount();
  }
});

test('buttons and groups follow function-valued presentation when a service store changes, without remounting', async () => {
  const config = {
    plugins: [
      definePlugin({
        id: 'access',
        services: {
          session: defineService(({ store }) => {
            const state = store({ roles: [] });
            return {
              state,
              grant: (role) => state.set((current) => ({ roles: [...current.roles, role] })),
              revoke: () => state.set({ roles: [] }),
            };
          }),
        },
        actions: {
          run: defineAction({
            title: 'Run',
            groups: ['menu'],
            enabled: ({ services, input }) =>
              services.access.session.state.get().roles.includes(input ?? 'admin'),
            execute() {},
          }),
        },
      }),
    ],
  };
  let runtime;
  let mounts = 0;
  function Capture() {
    runtime = useFoundation().runtime;
    useEffect(() => {
      mounts++;
    }, []);
    return null;
  }
  function Menu() {
    const groups = useActionGroups(['menu'], 'editor');
    return h(
      'div',
      null,
      ...groups.flatMap((entry) =>
        entry.items.map((item) =>
          h('button', { key: item.id, 'data-menu': true, disabled: item.disabled }, 'Menu'),
        ),
      ),
    );
  }
  const view = await mount(
    h(
      FoundationProvider,
      { config, ui: testUI },
      h(Capture),
      h(ActionButton, { action: 'access.run' }),
      h(Menu),
    ),
  );
  const buttons = () => [...view.container.querySelectorAll('button')];
  try {
    assert.ok(buttons().every((button) => button.disabled));
    await act(async () => runtime.services.access.session.grant('admin'));
    assert.equal(buttons()[0].disabled, false, 'the button input defaults to admin');
    assert.equal(buttons()[1].disabled, true, 'the group is bound to the editor role');
    await act(async () => runtime.services.access.session.grant('editor'));
    assert.ok(buttons().every((button) => !button.disabled));
    await act(async () => runtime.services.access.session.revoke());
    assert.ok(buttons().every((button) => button.disabled));
    assert.equal(mounts, 1, 'service changes never remount the tree');
  } finally {
    await view.unmount();
  }
});
