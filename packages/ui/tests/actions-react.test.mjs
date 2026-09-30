import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ActionProvider,
  useAction,
  useActionList,
  useRegisterAction,
} from '../dist/actions/index.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Register({ definition }) {
  useRegisterAction(definition);
  return null;
}

async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    root,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test('React bindings share updates, while unrelated action subscribers do not rerender', async () => {
  let list;
  const renders = { first: 0, second: 0, other: 0 };
  function Bind({ id, name }) {
    const action = useAction(id);
    renders[name]++;
    return h('span', { 'data-name': name }, action?.title ?? 'missing');
  }
  function Capture() {
    list = useActionList();
    return null;
  }
  const mounted = await mount(
    h(
      ActionProvider,
      null,
      h(Capture),
      h(Register, { definition: { id: 'save', title: 'Save' } }),
      h(Register, { definition: { id: 'other', title: 'Other' } }),
      h(Bind, { id: 'save', name: 'first' }),
      h(Bind, { id: 'save', name: 'second' }),
      h(Bind, { id: 'other', name: 'other' }),
    ),
  );
  try {
    const before = { ...renders };
    await act(async () => {
      list.update('save', { title: 'Publish' });
    });
    assert.equal(mounted.container.querySelector('[data-name="first"]').textContent, 'Publish');
    assert.equal(mounted.container.querySelector('[data-name="second"]').textContent, 'Publish');
    assert.equal(renders.other, before.other);
    assert.ok(renders.first > before.first && renders.second > before.second);
  } finally {
    await mounted.cleanup();
  }
});

test('providers are isolated even with identical action IDs', async () => {
  const lists = [];
  function Capture() {
    lists.push(useActionList());
    return null;
  }
  const mounted = await mount(
    h(
      'div',
      null,
      ...[1, 2].map((n) =>
        h(
          ActionProvider,
          { key: n },
          h(Capture),
          h(Register, { definition: { id: 'save', title: `Save ${n}` } }),
        ),
      ),
    ),
  );
  try {
    assert.notEqual(lists[0], lists[1]);
    await act(async () => {
      lists[0].update('save', { enabled: false });
    });
    assert.equal(lists[1].get('save').enabled, true);
  } finally {
    await mounted.cleanup();
  }
});

test('existing button and group bindings react to dependency changes without remounting', async () => {
  const { createActionList, ActionButton, ActionGroup, ActionGroupBinding } = await import(
    '../dist/actions/index.js'
  );
  const group = new ActionGroup('menu');
  const list = createActionList([
    { id: 'run', title: 'Run', dependsOn: ['access'], groups: [group] },
  ]);
  function Menu({ groups }) {
    return h(
      'div',
      null,
      ...groups.flatMap((group) =>
        group.items.map((item) => h('button', { key: item.id, disabled: item.disabled }, 'Menu')),
      ),
    );
  }
  const mounted = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(ActionButton, { action: 'run' }),
      h(ActionGroupBinding, { groups: [group], as: Menu, context: { allowed: true } }),
    ),
  );
  const buttons = () => [...mounted.container.querySelectorAll('button')];
  try {
    assert.ok(buttons().every((button) => button.disabled));
    let access;
    await act(async () => {
      access = list.register({ id: 'access', title: 'Access' });
    });
    assert.ok(buttons().every((button) => !button.disabled));
    await act(async () => {
      list.update('access', { resolve: (input) => ({ enabled: input?.allowed === true }) });
    });
    assert.equal(buttons()[0].disabled, true);
    assert.equal(buttons()[1].disabled, false);
    await act(async () => access.unregister());
    assert.ok(buttons().every((button) => button.disabled));
  } finally {
    await mounted.cleanup();
  }
});

test('Strict Mode registration survives setup/cleanup replay and unregisters on unmount', async () => {
  let list;
  function Capture() {
    list = useActionList();
    return null;
  }
  const definition = { id: 'save', title: 'Save' };
  const tree = (registered) =>
    h(
      StrictMode,
      null,
      h(ActionProvider, null, h(Capture), registered ? h(Register, { definition }) : null),
    );
  const mounted = await mount(tree(true));
  try {
    assert.equal(list.get('save').title, 'Save');
    await act(async () => mounted.root.render(tree(false)));
    assert.equal(list.get('save'), undefined);
    await act(async () => mounted.root.render(tree(true)));
    assert.equal(list.get('save').title, 'Save');
  } finally {
    await mounted.cleanup();
  }
  assert.equal(list.get('save'), undefined);
});

test('provider interceptors are optional, ordered and replaced without leaving old handlers', async () => {
  const { createActionList } = await import('../dist/actions/index.js');
  const calls = [];
  const list = createActionList([
    {
      id: 'run',
      title: 'Run',
      execute() {
        calls.push('run');
      },
    },
  ]);
  const first = {
    before() {
      calls.push('first');
    },
  };
  const stop = {
    before() {
      calls.push('stop');
      return false;
    },
  };
  const tree = (interceptors) =>
    h(StrictMode, null, h(ActionProvider, { actions: list, interceptors }, null));
  const mounted = await mount(tree([first, stop]));
  try {
    await act(async () => {
      assert.equal((await list.execute('run')).reason, 'intercepted');
    });
    assert.deepEqual(calls, ['first', 'stop']);
    calls.length = 0;
    await act(async () => mounted.root.render(tree(undefined)));
    await act(async () => {
      await list.execute('run');
    });
    assert.deepEqual(calls, ['run']);
  } finally {
    await mounted.cleanup();
  }
});

test('internal registrations stay executable but disappear from enumeration and group views', async () => {
  const { createActionList, ActionGroup, ActionGroupBinding, useActions } = await import(
    '../dist/actions/index.js'
  );
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
  function Menu({ groups }) {
    return h(
      'div',
      null,
      ...groups.flatMap((group) => group.items.map((item) => h('span', { key: item.id }, item.id))),
    );
  }
  const mounted = await mount(
    h(
      ActionProvider,
      { actions: list },
      h(Enumerate, { internal: false }),
      h(Enumerate, { internal: true }),
      h(ActionGroupBinding, { groups: [group], as: Menu, context: undefined }),
    ),
  );
  try {
    assert.deepEqual(seen.public, ['public']);
    assert.deepEqual(seen.all, ['public', 'helper']);
    assert.equal(mounted.container.textContent, 'public');
    assert.deepEqual(await list.execute('helper'), { status: 'completed', value: 'ran' });
  } finally {
    await mounted.cleanup();
  }
});
