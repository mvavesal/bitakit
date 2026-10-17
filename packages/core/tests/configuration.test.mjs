import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  defineAction,
  defineInterceptor,
  definePlugin,
  resolveBitaKitConfig,
} from '../dist/core.js';

const wrap = ({ children }) => children;

test('omitted lists inherit; explicit and empty lists replace only their domain without mutating discovery', () => {
  const app = defineAction({ id: 'app.run', execute() {} });
  const pluginAction = defineAction({ id: 'plugin.run', execute() {} });
  const plugin = definePlugin({ id: 'plugin', actions: [pluginAction] });
  const interceptor = defineInterceptor({ before() {} });
  const provider = { id: 'theme', component: wrap };
  const discovered = {
    actions: [app],
    plugins: [plugin],
    interceptors: [interceptor],
    ui: { providers: [provider] },
  };
  const inherited = resolveBitaKitConfig(discovered);
  assert.equal(inherited.actions, discovered.actions);
  assert.equal(inherited.plugins, discovered.plugins);
  assert.equal(inherited.interceptors, discovered.interceptors);
  assert.deepEqual(inherited.ui.providers, [provider]);
  const empty = resolveBitaKitConfig(discovered, {
    actions: [],
    interceptors: [],
    providers: [],
  });
  assert.deepEqual(empty.actions, []);
  assert.deepEqual(empty.plugins[0].actions, []);
  assert.deepEqual(empty.interceptors, []);
  assert.deepEqual(empty.ui.providers, []);
  assert.deepEqual(discovered.plugins[0].actions, [pluginAction]);
  const replacement = defineAction({ id: 'replacement', execute() {} });
  const manual = resolveBitaKitConfig(discovered, { actions: [replacement] });
  const runtime = createRuntime(manual);
  const cleanup = runtime.mount();
  assert.deepEqual(Object.keys(runtime.actions.getState().actions), ['replacement']);
  cleanup();
  const noPlugins = resolveBitaKitConfig(
    { ...discovered, configOverrides: { plugin: { a: 1 } } },
    { plugins: [] },
  );
  assert.deepEqual(noPlugins.plugins, []);
  assert.equal(noPlugins.actions, discovered.actions);
  assert.deepEqual(noPlugins.configOverrides, {}, 'overrides of removed plugins are dropped');
  assert.throws(() => resolveBitaKitConfig({ plugins: [plugin, plugin] }), /duplicate plugin/);
});

test('provider order is explicit; plugin providers come first; missing, reversed, cyclic and duplicate requirements fail early', () => {
  const theme = { id: 'theme', component: wrap };
  const widgets = { id: 'widgets', component: wrap, requires: ['theme'] };
  assert.deepEqual(resolveBitaKitConfig({ ui: { providers: [theme, widgets] } }).ui.providers, [
    theme,
    widgets,
  ]);
  const fromPlugin = { id: 'query', component: wrap };
  assert.deepEqual(
    resolveBitaKitConfig({
      plugins: [definePlugin({ id: 'data', ui: { providers: [fromPlugin] } })],
      ui: { providers: [theme] },
    }).ui.providers,
    [fromPlugin, theme],
  );
  assert.throws(
    () => resolveBitaKitConfig({ ui: { providers: [widgets, theme] } }),
    /requires "theme" before/,
  );
  assert.throws(
    () => resolveBitaKitConfig({ ui: { providers: [theme, theme] } }),
    /duplicate provider/,
  );
  assert.throws(
    () =>
      resolveBitaKitConfig({
        ui: { providers: [{ ...theme, requires: ['widgets'] }, widgets] },
      }),
    /requires/,
  );
});
