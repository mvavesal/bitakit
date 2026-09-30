import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import { definePage, findPluginPage, FoundationRuntime } from '../dist/core.js';
const component = () => null;
test('plugin pages resolve exact nested paths and disappear with their owner', () => {
  const plugins = [{ id: 'demo', pages: [definePage({ path: '/demo/details', component })] }];
  assert.equal(findPluginPage(plugins, '/demo/details/').component, component);
  assert.equal(findPluginPage(plugins, '/demo'), undefined);
  assert.equal(findPluginPage([], '/demo/details'), undefined);
});
test('runtime rejects conflicting and unsafe page paths before mounting', () => {
  const runtime = (pages) =>
    new FoundationRuntime(createActionList(), { plugins: [{ id: 'demo', pages }] });
  for (const path of [
    'https://example.com',
    '//example.com',
    '/a/../b',
    '/a?x=1',
    '/a#x',
    '/a/',
    '/a%2fb',
  ]) {
    assert.throws(() => runtime([{ path, component }]), /Invalid plugin page/);
  }
  assert.throws(
    () =>
      runtime([
        { path: '/a', component },
        { path: '/a', component },
      ]),
    /Duplicate plugin page/,
  );
  assert.doesNotThrow(() =>
    runtime([
      { path: '/', component },
      { path: '/a/b', component },
    ]),
  );
});
