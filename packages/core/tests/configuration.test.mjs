import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFoundationConfig,
  defineAction,
  defineInterceptor,
  defineProvider,
  FoundationRuntime,
} from '../dist/core.js';
import { createActionList } from '@bitakit/core/actions';

const wrap = ({ children }) => children;
test('omitted lists inherit; explicit and empty lists replace only their domain without mutating discovery', () => {
  const app = defineAction({ id: 'app.run' });
  const pluginAction = defineAction({ id: 'plugin.run' });
  const plugin = { id: 'plugin', actions: [pluginAction] };
  const interceptor = defineInterceptor({ create: () => ({ before() {} }) });
  const provider = defineProvider({ id: 'theme', component: wrap });
  const discovered = {
    actions: [app],
    plugins: [plugin],
    interceptors: [interceptor],
    providers: [provider],
  };
  const inherited = resolveFoundationConfig(discovered);
  assert.equal(inherited.actions, discovered.actions);
  assert.equal(inherited.plugins, discovered.plugins);
  assert.equal(inherited.interceptors, discovered.interceptors);
  assert.equal(inherited.providers, discovered.providers);
  const empty = resolveFoundationConfig(discovered, {
    actions: [],
    interceptors: [],
    providers: [],
  });
  assert.deepEqual(empty.actions, []);
  assert.deepEqual(empty.plugins[0].actions, []);
  assert.deepEqual(empty.interceptors, []);
  assert.deepEqual(empty.providers, []);
  assert.deepEqual(discovered.plugins[0].actions, [pluginAction]);
  const replacement = defineAction({ id: 'replacement' });
  const manual = resolveFoundationConfig(discovered, { actions: [replacement] });
  const list = createActionList();
  const runtime = new FoundationRuntime(list, manual);
  const cleanup = runtime.mount();
  assert.deepEqual(Object.keys(list.getState().actions), ['replacement']);
  cleanup();
  const noPlugins = resolveFoundationConfig(discovered, { plugins: [] });
  assert.deepEqual(noPlugins.plugins, []);
  assert.equal(noPlugins.actions, discovered.actions);
});

test('provider order is explicit; missing, reversed, cyclic and duplicate requirements fail early', () => {
  const theme = defineProvider({ id: 'theme', component: wrap });
  const widgets = defineProvider({ id: 'widgets', component: wrap, requires: ['theme'] });
  assert.deepEqual(resolveFoundationConfig({ providers: [theme, widgets] }).providers, [
    theme,
    widgets,
  ]);
  assert.throws(
    () => resolveFoundationConfig({ providers: [widgets, theme] }),
    /requires "theme" before/,
  );
  assert.throws(() => resolveFoundationConfig({ providers: [theme, theme] }), /duplicate provider/);
  assert.throws(
    () => resolveFoundationConfig({ providers: [{ ...theme, requires: ['widgets'] }, widgets] }),
    /requires/,
  );
});
