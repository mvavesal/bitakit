import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { installDom, mount, click, tick, deferred, silenced, testUI } from './support.mjs';
import { ActionProvider, ActionButton, createActionList } from '../dist/actions/index.js';
import {
  FoundationProvider,
  defineAction,
  definePlugin,
  defineService,
  useFoundationApp,
} from '../dist/index.js';

installDom();

const healthy = definePlugin({
  id: 'healthy',
  actions: { ping: defineAction({ title: 'Ping', execute: () => 'pong' }) },
});
const broken = definePlugin({
  id: 'broken',
  services: {
    store: defineService(() => {
      throw new Error('database offline');
    }),
  },
});
const dependent = definePlugin({
  id: 'dependent',
  dependencies: ['broken'],
  actions: { go: defineAction({ execute() {} }) },
});
/** A plugin that constructs fine and whose onStart settles when the test decides. */
function startsLater(id, services = {}) {
  const start = deferred();
  const plugin = definePlugin({
    id,
    services: {
      ...services,
      sync: defineService(({ onStart }) => {
        onStart(() => start.promise);
        return {};
      }),
    },
    actions: { run: defineAction({ title: 'Run', execute() {} }) },
  });
  const fail = (message) =>
    act(async () => {
      start.reject(new Error(message));
      await tick();
    });
  return { plugin, fail };
}

async function render(
  props,
  content = h('main', null, h(ActionButton, { action: 'healthy.ping' })),
) {
  const list = createActionList();
  const { value: view, errors } = await silenced(() =>
    mount(
      h(
        ActionProvider,
        { actions: list },
        h(FoundationProvider, { ui: testUI, ...props }, content),
      ),
    ),
  );
  return { ...view, list, errors };
}

test('development isolation turns off a failing plugin and its dependents and keeps the app running', async () => {
  const view = await render({ isolateFailures: true, plugins: [healthy, broken, dependent] });
  try {
    assert.equal(view.list.get('healthy.ping')?.enabled, true);
    assert.equal(view.list.get('dependent.go'), undefined);
    assert.ok(view.container.querySelector('main button'), 'the rest of the app renders');
    const dialog = view.container.querySelector('[role=dialog]');
    assert.match(dialog.textContent, /Plugin "broken" was turned off/);
    assert.match(
      dialog.textContent,
      /Service "broken.store" in plugin "broken" failed to start: database offline/,
    );
    assert.match(dialog.textContent, /Also turned off because they depend on it: dependent\./);
    assert.ok(
      view.errors.some((message) => /database offline/.test(message)),
      'the failure is also logged',
    );
    const dismiss = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Dismiss',
    );
    await click(dismiss);
    assert.equal(view.container.querySelector('[role=dialog]'), null);
    await act(async () => assert.equal((await view.list.execute('healthy.ping')).value, 'pong'));
  } finally {
    await view.unmount();
  }
});

test('construction-time conflicts are isolated to the plugin that introduced them', async () => {
  const one = definePlugin({
    id: 'one',
    services: { store: defineService(() => ({}), { exposeAs: 'store' }) },
  });
  const two = definePlugin({
    id: 'two',
    services: { store: defineService(() => ({}), { exposeAs: 'store' }) },
  });
  const view = await render({ isolateFailures: true, plugins: [healthy, one, two] });
  try {
    assert.match(view.container.textContent, /Plugin "two" was turned off/);
    assert.match(
      view.container.textContent,
      /Two services are named "store" \(one\.store and two\.store\)/,
    );
    assert.equal(view.list.get('healthy.ping')?.enabled, true);
  } finally {
    await view.unmount();
  }
});

test('an application-level failure shows the fatal report instead of a broken page', async () => {
  const view = await render({
    isolateFailures: true,
    plugins: [healthy],
    actions: { report: defineAction({ requires: ['missing'], execute() {} }) },
  });
  try {
    assert.match(view.container.textContent, /The app failed to start/);
    assert.match(view.container.textContent, /Action "report" requires service "missing"/);
    assert.equal(view.container.querySelector('main'), null);
  } finally {
    await view.unmount();
  }
});

test('a rejecting onStart is isolated after mount like a construction failure; app-level rejections are fatal', async () => {
  const slow = startsLater('slow');
  const view = await render({ isolateFailures: true, plugins: [healthy, slow.plugin] });
  try {
    assert.ok(view.list.get('slow.run'), 'the plugin is mounted until its start hook settles');
    assert.equal(view.container.querySelector('[role=dialog]'), null);
    const { errors } = await silenced(() => slow.fail('sync failed'));
    assert.equal(view.list.get('slow.run'), undefined, 'the failed plugin is turned off');
    assert.equal(view.list.get('healthy.ping')?.enabled, true);
    const dialog = view.container.querySelector('[role=dialog]');
    assert.match(dialog.textContent, /Plugin "slow" was turned off/);
    assert.match(dialog.textContent, /onStart in plugin "slow" failed: sync failed/);
    assert.ok(errors.some((message) => /sync failed/.test(message)));
    await act(async () => assert.equal((await view.list.execute('healthy.ping')).value, 'pong'));
  } finally {
    await view.unmount();
  }
  const boot = deferred();
  const app = {
    isolateFailures: true,
    config: {
      plugins: [healthy],
      services: {
        boot: defineService(({ onStart }) => {
          onStart(() => boot.promise);
          return {};
        }),
      },
    },
  };
  const fatal = await render(app);
  try {
    assert.ok(fatal.container.querySelector('main'));
    await silenced(() =>
      act(async () => {
        boot.reject(new Error('boot failed'));
        await tick();
      }),
    );
    assert.match(fatal.container.textContent, /The app failed to start/);
    assert.match(fatal.container.textContent, /onStart in the app failed: boot failed/);
    assert.equal(fatal.container.querySelector('main'), null);
  } finally {
    await fatal.unmount();
  }
});

test('a host component that still requires a turned-off plugin service gets an actionable report', async () => {
  const inventory = definePlugin({
    id: 'inventory',
    services: {
      items: defineService(
        () => {
          throw new Error('database offline');
        },
        { exposeAs: 'stock' },
      ),
    },
  });
  // A correct host component: it waits for readiness, then requires the service.
  function Stock() {
    const app = useFoundationApp();
    return h('p', null, app.ready ? `${app.services.stock.count()} items` : 'Loading');
  }
  const view = await render(
    { isolateFailures: true, plugins: [healthy, inventory] },
    h('main', null, h(Stock)),
  );
  try {
    const notice = view.container.querySelector('[role=alert]');
    assert.match(
      notice.textContent,
      /requires the service "stock" from plugin "inventory", which was turned off because it failed to start/,
    );
    assert.match(notice.textContent, /app\.has\('stock'\)/, 'the report names the readiness check');
    const dialog = view.container.querySelector('[role=dialog]');
    assert.match(
      dialog.textContent,
      /Service "inventory.items" in plugin "inventory" failed to start: database offline/,
    );
    assert.ok(
      view.errors.some((message) =>
        /requires the service "stock" from plugin "inventory"/.test(message),
      ),
    );
    await act(async () => assert.equal((await view.list.execute('healthy.ping')).value, 'pong'));
  } finally {
    await view.unmount();
  }
  // A plugin turned off only because it depends on the failed one is named as such.
  const reports = definePlugin({
    id: 'reports',
    dependencies: ['inventory'],
    services: { summary: defineService(() => ({ total: () => 0 }), { exposeAs: 'summary' }) },
  });
  function Summary() {
    const app = useFoundationApp();
    return h('p', null, app.ready ? String(app.services.summary.total()) : 'Loading');
  }
  const dependentView = await render(
    { isolateFailures: true, plugins: [healthy, inventory, reports] },
    h(Summary),
  );
  try {
    assert.match(
      dependentView.container.querySelector('[role=alert]').textContent,
      /service "summary" from plugin "reports", which was turned off because it depends on a plugin that failed to start/,
    );
  } finally {
    await dependentView.unmount();
  }
  // Errors unrelated to the turned-off plugin still reach the host as before.
  function Broken() {
    throw new Error('component bug');
  }
  await assert.rejects(
    () => render({ isolateFailures: true, plugins: [healthy, inventory] }, h(Broken)),
    /component bug/,
  );
});

test('without isolation startup errors propagate: synchronous ones from render, asynchronous ones from the next render', async () => {
  await assert.rejects(
    () => render({ isolateFailures: false, plugins: [healthy, broken] }),
    /Service "broken.store" in plugin "broken" failed to start: database offline/,
  );
  const slow = startsLater('slow');
  const view = await render({ isolateFailures: false, plugins: [healthy, slow.plugin] });
  assert.ok(view.list.get('slow.run'));
  await assert.rejects(
    () => silenced(() => slow.fail('sync failed')),
    /onStart in plugin "slow" failed: sync failed/,
  );
});

test('replacement waits for async cleanup and skips intermediate compositions', async () => {
  const cleanup = deferred();
  const log = [];
  const plugin = (id, stop) =>
    definePlugin({
      id,
      services: {
        value: defineService(({ onStop }) => {
          log.push(`start:${id}`);
          onStop(stop ?? (() => {}));
          return {};
        }),
      },
    });
  const first = plugin('first', async () => {
    log.push('stopping:first');
    await cleanup.promise;
    log.push('stopped:first');
  });
  const second = plugin('second');
  const third = plugin('third');
  const tree = (plugins) =>
    h(FoundationProvider, { ui: testUI, plugins, isolateFailures: false }, h('main'));
  const view = await mount(tree([first]));
  try {
    await view.render(tree([second]));
    await view.render(tree([third]));
    assert.deepEqual(log, ['start:first', 'stopping:first']);
    await act(async () => {
      cleanup.resolve();
      await tick();
    });
    assert.deepEqual(log, ['start:first', 'stopping:first', 'stopped:first', 'start:third']);
  } finally {
    cleanup.resolve();
    await view.unmount();
  }
});

test('failed previous cleanup prevents replacement from starting', async () => {
  let nextStarted = false;
  const first = definePlugin({
    id: 'first',
    services: {
      value: defineService(({ onStop }) => {
        onStop(async () => {
          throw new Error('connection still open');
        });
        return {};
      }),
    },
  });
  const next = definePlugin({
    id: 'next',
    services: {
      value: defineService(() => {
        nextStarted = true;
        return {};
      }),
    },
  });
  const tree = (plugins) =>
    h(FoundationProvider, { ui: testUI, plugins, isolateFailures: true }, h('main'));
  const view = await mount(tree([first]));
  try {
    await silenced(() => view.render(tree([next])));
    assert.equal(nextStarted, false);
    assert.match(view.container.textContent, /cleanup failed/);
  } finally {
    await silenced(() => view.unmount());
  }
});

test('isolating a plugin removes its projected providers and config overrides', async () => {
  function BrokenProvider({ children }) {
    return h('section', { 'data-broken-provider': true }, children);
  }
  const plugin = definePlugin({
    ...broken,
    config: { retry: 1 },
    ui: { providers: [{ id: 'broken-context', component: BrokenProvider }] },
  });
  const dependentProvider = definePlugin({
    id: 'dependent-provider',
    ui: {
      providers: [
        { id: 'dependent-context', requires: ['broken-context'], component: BrokenProvider },
      ],
    },
  });
  const view = await render({
    isolateFailures: true,
    config: {
      plugins: [healthy, plugin, dependentProvider],
      configOverrides: { broken: { retry: 2 } },
    },
  });
  try {
    assert.equal(view.list.get('healthy.ping')?.enabled, true);
    assert.equal(view.container.querySelector('[data-broken-provider]'), null);
    assert.match(view.container.textContent, /dependent-provider/);
    assert.doesNotMatch(view.container.textContent, /The app failed to start/);
  } finally {
    await view.unmount();
  }
});
