import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, defineAction, definePlugin } from '../dist/core.js';

test('href actions render as links and execute as navigation once the list is mounted with a navigate function', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          open: defineAction({ title: 'Todos', href: '/todos', groups: ['navigation'] }),
          item: defineAction({ title: 'Item', href: ({ input }) => `/todos/${input}` }),
          docs: defineAction({ title: 'Docs', href: 'https://example.com/docs' }),
          unsafe: defineAction({ title: 'Unsafe', href: () => 'javascript:alert(1)' }),
        },
      }),
    ],
  });
  const { actions } = runtime;
  const stop = runtime.mount();
  try {
    const open = actions.get('todos.open');
    assert.equal(open.href, '/todos');
    assert.equal(typeof open.execute, 'function', 'a navigation action is executable');
    assert.equal(open.groups[0].id, 'navigation');
    await assert.rejects(actions.execute('todos.open'), /Navigation is not mounted/);
    const visits = [];
    const unmount = actions.mount((href) => visits.push(href));
    assert.deepEqual(await actions.execute('todos.open'), {
      status: 'completed',
      value: undefined,
    });
    await actions.execute('todos.docs');
    assert.equal(actions.resolve('todos.item', 7).href, '/todos/7');
    await actions.execute('todos.item', 7);
    assert.deepEqual(visits, ['/todos', 'https://example.com/docs', '/todos/7']);
    await assert.rejects(actions.execute('todos.unsafe'), /Invalid navigation target/);
    assert.equal(visits.length, 3);
    unmount();
    await assert.rejects(actions.execute('todos.open'), /Navigation is not mounted/);
  } finally {
    stop();
  }
});

test('an action with execute runs its handler even when it also has an href', async () => {
  const visits = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          open: defineAction({
            title: 'Open',
            href: '/todos',
            execute: ({ input }) => `handled:${input}`,
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  const unmount = runtime.actions.mount((href) => visits.push(href));
  try {
    assert.equal(runtime.actions.get('todos.open').href, '/todos');
    assert.equal((await runtime.actions.execute('todos.open', 1)).value, 'handled:1');
    assert.deepEqual(visits, []);
  } finally {
    unmount();
    stop();
  }
});

test('an action without execute, href or dialog is a plain presentation entry that skips with no-handler', async () => {
  const runtime = createRuntime({
    plugins: [definePlugin({ id: 'todos', actions: { label: defineAction({ title: 'Label' }) } })],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.actions.get('todos.label').execute, undefined);
    assert.deepEqual(await runtime.actions.execute('todos.label'), {
      status: 'skipped',
      reason: 'no-handler',
    });
  } finally {
    stop();
  }
});
