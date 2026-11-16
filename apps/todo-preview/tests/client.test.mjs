import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { definePlugin, defineSlot } from '@bitakit/core';
import { identity, mountPlugin, mountServer } from '@bitakit/core/testing';

// The client half of todos calls its real server half in-process instead of over HTTP.
const server = await mountServer('src/plugins/todos');
after(() => server.stop());

// todos places its navigation Action in Shell's slot; this stand-in owns it so the plugin starts without Shell.
const shell = definePlugin({
  id: 'shell',
  slots: { navigation: defineSlot({ accepts: 'actions' }) },
});

/** The browser session as the Better Auth integration reports it; `switch` changes it. */
function session(snapshot) {
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signOut() {},
    switch(next) {
      snapshot = { ...snapshot, ...next };
      for (const listener of listeners) listener();
    },
  };
}

/**
 * The client plugin for a browser session in `organizationId` whose server session is in
 * `serverOrganization` (another tab may have moved it).
 */
async function mount(organizationId, serverOrganization = organizationId) {
  const auth = session({ user: { id: 'user-1' }, organizationId, pending: false });
  const plugin = await mountPlugin('src/plugins/todos', {
    plugins: [shell],
    services: { auth },
    remote: server.as(identity({ organization: serverOrganization })),
  });
  // No confirmation dialog headlessly: confirm every question, as a person would.
  plugin.runtime.setConfirm(() => true);
  return { plugin, auth, items: plugin.services.todos.items };
}

/** The service's state once the current load finished. */
async function loaded(items) {
  for (let tries = 0; items.state.get().pending; tries++) {
    assert.ok(tries < 200, 'tasks never loaded');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return items.state.get();
}
const titles = (items) => items.state.get().items.map((item) => item.title);

test('the page service loads and changes tasks through the server operations', async () => {
  await server.as(identity({ organization: 'org-client' })).todos.add({ title: 'From the server' });
  const { plugin, items } = await mount('org-client');
  try {
    assert.deepEqual(
      (await loaded(items)).items.map((item) => item.title),
      ['From the server'],
    );
    assert.equal((await plugin.execute('todos.add', 'Added by the button')).status, 'completed');
    assert.deepEqual(titles(items), ['From the server', 'Added by the button']);
    const [first] = items.state.get().items;
    await plugin.execute('todos.complete', { id: first.id, completed: true });
    await plugin.execute('todos.edit', { id: first.id, title: 'Edited' });
    assert.deepEqual(items.state.get().items[0], {
      id: first.id,
      title: 'Edited',
      completed: true,
    });
    await plugin.execute('todos.remove', first.id);
    assert.deepEqual(titles(items), ['Added by the button']);
    // Quick Search reads through the same service, with its abort signal.
    assert.deepEqual(
      (await items.read(new AbortController().signal)).map((item) => item.title),
      ['Added by the button'],
    );
    assert.equal((await plugin.execute('todos.clear')).status, 'completed');
    assert.deepEqual(items.state.get().items, []);
    assert.deepEqual(await server.as(identity({ organization: 'org-client' })).todos.list(), {
      items: [],
    });
  } finally {
    await plugin.stop();
  }
});

test('an organization switch reloads, and a confirmation for the old one clears nothing', async () => {
  await server.as(identity({ organization: 'org-switch-b' })).todos.add({ title: 'Keep B' });
  const { plugin, auth, items } = await mount('org-switch-a', 'org-switch-b');
  try {
    await loaded(items);
    items.confirmClear();
    auth.switch({ organizationId: 'org-switch-b' });
    assert.equal(items.state.get().organizationId, 'org-switch-b');
    assert.deepEqual(
      (await loaded(items)).items.map((item) => item.title),
      ['Keep B'],
    );
    assert.throws(() => items.clear(), {
      message: 'The account or organization changed. Confirm again to clear its tasks.',
    });
    assert.deepEqual(titles(items), ['Keep B']);
  } finally {
    await plugin.stop();
  }
});

test('a change from a page of another organization than the server session is refused', async () => {
  // The browser still shows org-page-a; another tab moved the server session to org-page-b.
  const { plugin, items } = await mount('org-page-a', 'org-page-b');
  try {
    const { error } = await loaded(items);
    assert.equal(error, 'The active organization changed. Reload and try again.');
    await assert.rejects(items.add('Lands in the wrong organization'), {
      code: 'CONFLICT',
      reason: 'ORGANIZATION_CHANGED',
    });
    assert.deepEqual(await server.as(identity({ organization: 'org-page-b' })).todos.list(), {
      items: [],
    });
  } finally {
    await plugin.stop();
  }
});

test('a signed-out browser loads nothing and calls no operation', async () => {
  const auth = session({ user: null, organizationId: null, pending: false });
  const calls = [];
  const plugin = await mountPlugin('src/plugins/todos', {
    plugins: [shell],
    services: { auth },
    remote: { todos: { list: async (...args) => calls.push(args) } },
  });
  try {
    assert.deepEqual(plugin.services.todos.items.state.get(), {
      items: [],
      pending: false,
      error: '',
      organizationId: '',
    });
    assert.deepEqual(await plugin.services.todos.items.read(), []);
    assert.deepEqual(calls, []);
  } finally {
    await plugin.stop();
  }
});
