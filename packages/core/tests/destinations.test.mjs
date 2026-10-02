import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, defineAction, definePlugin, destinationMetadata } from '../dist/core.js';

const page = (path) => ({ path, component: () => null });
const link = (title, href) => defineAction({ title, href });

test('a navigation action names its destination kind and owning plugin from existing registrations', () => {
  const runtime = createRuntime({
    ui: { pages: [page('/')] },
    actions: { home: link('Home', '/') },
    plugins: [
      definePlugin({
        id: 'todos',
        ui: { pages: [page('/todos/tasks')] },
        actions: {
          tasks: link('Tasks', '/todos/tasks'),
          board: link('Board', '/board?view=all'),
          home: link('Start', '/'),
        },
      }),
      definePlugin({
        id: 'links',
        actions: {
          tasks: link('Tasks', '/todos/tasks/#top'),
          docs: link('Docs', 'https://example.com/docs'),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    const of = (id) => runtime.destinationOf(runtime.actions.resolve(id));
    // The page registry names the owner, also for links contributed elsewhere.
    assert.deepEqual(of('todos.tasks'), { kind: 'page', plugin: 'todos' });
    assert.deepEqual(of('links.tasks'), { kind: 'page', plugin: 'todos' });
    // A route outside the registry belongs to the plugin that contributed the link.
    assert.deepEqual(of('todos.board'), { kind: 'page', plugin: 'todos' });
    // Pages of the application are never attributed to a plugin.
    assert.deepEqual(of('home'), { kind: 'page' });
    assert.deepEqual(of('todos.home'), { kind: 'page' });
    assert.equal(of('links.docs'), undefined);
    // Integrations carry the owner they already know; the application is not named.
    const projected = (destination) =>
      runtime.destinationOf({
        id: 'x',
        href: '/settings/x',
        metadata: destinationMetadata(destination),
      });
    assert.deepEqual(projected({ kind: 'settings', plugin: 'todos' }), {
      kind: 'settings',
      plugin: 'todos',
    });
    assert.deepEqual(projected({ kind: 'settings', plugin: 'app' }), { kind: 'settings' });
    assert.deepEqual(projected({ kind: 'plugin', plugin: 'todos' }), {
      kind: 'plugin',
      plugin: 'todos',
    });
    // Unknown or foreign metadata never invents a kind.
    assert.equal(
      runtime.destinationOf({ id: 'y', metadata: { foundationDestination: { kind: 'other' } } }),
      undefined,
    );
    assert.deepEqual(
      runtime.destinationOf({ id: 'z', href: '/z', metadata: { confirmation: true } }),
      { kind: 'page' },
    );
  } finally {
    stop();
  }
});
