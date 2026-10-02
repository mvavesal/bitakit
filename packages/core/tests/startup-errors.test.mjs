import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationStartupError,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  isFoundationStartupError,
} from '../dist/core.js';

const startupError = (fn, expectations) =>
  assert.throws(fn, (error) => {
    assert.ok(
      isFoundationStartupError(error) && error instanceof FoundationStartupError,
      `expected a FoundationStartupError, got ${error?.name}: ${error?.message}`,
    );
    for (const [key, value] of Object.entries(expectations))
      value instanceof RegExp ? assert.match(error[key], value) : assert.equal(error[key], value);
    return true;
  });
const page = (path) => ({ path, component: () => null });

test('duplicate plugin IDs are rejected before anything mounts', () => {
  startupError(
    () =>
      createRuntime({ plugins: [definePlugin({ id: 'todos' }), definePlugin({ id: 'todos' })] }),
    {
      plugin: 'todos',
      message: /Plugin ID "todos" is used twice/,
    },
  );
});

test('a missing plugin dependency names the plugin, the dependency and the known plugins', () => {
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({ id: 'todos', dependencies: ['shell'] }),
          definePlugin({ id: 'notes' }),
        ],
      }),
    {
      plugin: 'todos',
      app: false,
      message:
        /Plugin "todos" depends on "shell", which is not installed or is disabled\. Known plugins: app, todos, notes\./,
    },
  );
});

test('a plugin dependency cycle is reported as a path', () => {
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({ id: 'a', dependencies: ['b'] }),
          definePlugin({ id: 'b', dependencies: ['c'] }),
          definePlugin({ id: 'c', dependencies: ['a'] }),
        ],
      }),
    { plugin: 'a', message: /Plugin dependency cycle: a → b → c → a\./ },
  );
});

test('page paths are validated and a path used by two plugins names both owners', () => {
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({ id: 'one', ui: { pages: [page('/shared')] } }),
          definePlugin({ id: 'two', ui: { pages: [page('/shared')] } }),
        ],
      }),
    { plugin: 'two', message: /Plugins "one" and "two" both define a page at \/shared\./ },
  );
  startupError(
    () =>
      createRuntime({
        plugins: [definePlugin({ id: 'one', ui: { pages: [page('https://example.com')] } })],
      }),
    {
      plugin: 'one',
      message:
        /Invalid plugin page path "https:\/\/example\.com" in plugin "one"\. Use a root-relative path such as \/todos\./,
    },
  );
  startupError(() => createRuntime({ pages: [page('/a'), page('/a')] }), {
    plugin: 'app',
    message: /both define a page at \/a/,
  });
});

test('an invalid href is attributed to the action and its plugin at mount, and nothing stays registered', () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'links',
        actions: {
          ok: defineAction({ title: 'OK', href: '/ok' }),
          evil: defineAction({ title: 'Evil', href: 'javascript:alert(1)' }),
        },
      }),
    ],
  });
  startupError(() => runtime.mount(), {
    plugin: 'links',
    app: false,
    message:
      /Action "links\.evil" in plugin "links" failed to start: Action "links\.evil" has an invalid navigation target: javascript:alert\(1\)/,
  });
  assert.deepEqual(Object.keys(runtime.actions.getState().actions), []);
});

test('duplicate action IDs across plugins and duplicate service names are attributed to the second owner', () => {
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({
            id: 'a',
            actions: { run: defineAction({ id: 'shared.run', execute() {} }) },
          }),
          definePlugin({
            id: 'b',
            actions: { run: defineAction({ id: 'shared.run', execute() {} }) },
          }),
        ],
      }).mount(),
    {
      plugin: 'b',
      message:
        /Action "shared\.run" in plugin "b" failed to start: Action "shared\.run" is already registered/,
    },
  );
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({
            id: 'todos',
            services: { store: defineService(() => ({}), { exposeAs: 'store' }) },
          }),
          definePlugin({
            id: 'notes',
            services: { store: defineService(() => ({}), { exposeAs: 'store' }) },
          }),
        ],
      }),
    {
      plugin: 'notes',
      message: /Two services are named "store" \(todos\.store and notes\.store\)/,
    },
  );
});

test('configOverrides for an unknown module name the known modules', () => {
  assert.throws(
    () =>
      createRuntime({
        configOverrides: { shop: { tax: 1 } },
        plugins: [definePlugin({ id: 'todos' })],
      }),
    /configOverrides names "shop", but no plugin with that ID is enabled\. Known: app, todos\./,
  );
});

test('plugin definition errors are attributed: invalid action IDs, array services without id, missing plugin id', () => {
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({ id: 'todos', actions: { 'bad id': defineAction({ execute() {} }) } }),
        ],
      }),
    {
      plugin: 'todos',
      message: /Plugin definition in plugin "todos": Invalid action ID "todos\.bad id"/,
    },
  );
  startupError(() => createRuntime({ services: [defineService(() => ({}))] }), {
    plugin: 'app',
    app: true,
    message: /Plugin definition in the app: A service in an array needs an id/,
  });
  assert.throws(() => definePlugin({}), /definePlugin needs an id/);
  assert.throws(() => definePlugin({ id: '' }), /definePlugin needs an id/);
});

test('contribution kinds without an installer or with two installers are attributed', () => {
  startupError(
    () =>
      createRuntime({
        plugins: [definePlugin({ id: 'widgets', contributions: { panels: ['a'] } })],
      }).mount(),
    {
      plugin: 'widgets',
      message: /"widgets" contributes "panels", but no enabled plugin installs that kind/,
    },
  );
  startupError(
    () =>
      createRuntime({
        plugins: [
          definePlugin({ id: 'one', installs: { panels: () => {} } }),
          definePlugin({ id: 'two', installs: { panels: () => {} } }),
        ],
      }).mount(),
    { plugin: 'two', message: /Contribution kind "panels" is installed by both "one" and "two"/ },
  );
});
