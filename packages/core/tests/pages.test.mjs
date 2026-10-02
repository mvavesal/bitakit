import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  findPluginPage,
  pluginPage,
  pluginProvider,
  pluginSlot,
} from '../dist/core.js';

const component = () => null;

test('plugin pages resolve exact and parameterized paths, exact paths win, and the owner is named', () => {
  const plugins = [
    {
      id: 'demo',
      pages: [
        { path: '/demo/details', component },
        { path: '/demo/[id]', component },
      ],
    },
    { id: 'other', pages: [{ path: '/demo/[slug]', component }] },
  ];
  assert.equal(findPluginPage(plugins, '/demo/details/').component, component);
  assert.deepEqual(findPluginPage(plugins, '/demo/details').params, {});
  const dynamic = findPluginPage(plugins, '/demo/42');
  assert.deepEqual(dynamic.params, { id: '42' });
  assert.equal(dynamic.plugin, 'demo');
  assert.equal(dynamic.key, 'demo:/demo/[id]');
  assert.equal(findPluginPage(plugins, '/demo'), undefined);
  assert.equal(findPluginPage([], '/demo/details'), undefined);
});

test('runtime rejects conflicting and unsafe page paths before mounting; ui.pages is the current field', () => {
  const runtime = (pages) =>
    createRuntime({ plugins: [definePlugin({ id: 'demo', ui: { pages } })] });
  for (const path of [
    'https://example.com',
    '//example.com',
    '/a/../b',
    '/a?x=1',
    '/a#x',
    '/a/',
    '/a%2fb',
  ])
    assert.throws(() => runtime([{ path, component }]), /Invalid plugin page path/, path);
  assert.throws(
    () =>
      runtime([
        { path: '/a', component },
        { path: '/a', component },
      ]),
    /Plugins "demo" and "demo" both define a page at \/a/,
  );
  assert.doesNotThrow(() =>
    runtime([
      { path: '/', component },
      { path: '/a/b', component },
      { path: '/a/[id]', component },
    ]),
  );
  const mounted = createRuntime({
    plugins: [
      definePlugin({ id: 'demo', ui: { pages: [{ path: '/demo', component, layout: 'blank' }] } }),
    ],
  });
  assert.equal(findPluginPage(mounted.modules, '/demo').layout, 'blank');
});

test('ui/pages, ui/slots and ui/providers modules map to definitions from their file names', () => {
  const Component = () => null;
  assert.deepEqual(pluginPage({ default: Component, layout: 'admin' }, '/todos'), {
    path: '/todos',
    component: Component,
    layout: 'admin',
  });
  assert.deepEqual(pluginPage({ default: { path: '/custom', component: Component } }, '/todos'), {
    path: '/custom',
    component: Component,
  });
  assert.deepEqual(pluginSlot({ default: Component, order: 2 }, 'app-bar.end'), {
    slot: 'app-bar.end',
    component: Component,
    order: 2,
  });
  assert.deepEqual(pluginProvider({ default: Component, requires: ['theme'] }, 'query'), {
    id: 'query',
    component: Component,
    requires: ['theme'],
  });
  assert.deepEqual(pluginProvider({ default: Component, id: 'named' }, 'query').id, 'named');
});
