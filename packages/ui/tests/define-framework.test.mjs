import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { installDom, mount, testUI } from './support.mjs';
import { defineFramework, useBitaKitNavigation } from '../dist/index.js';
import { definePlugin } from '@bitakit/core';

installDom();

test('defineFramework feeds the host router into the shared navigation context', async () => {
  const navigations = [];
  const Link = ({ href, children }) => h('a', { href }, children);
  const framework = defineFramework({
    id: 'fake',
    useRouter: () => ({
      pathname: '/todos/42',
      params: { id: '42' },
      navigate: (href, options) => navigations.push([href, options?.replace ?? false]),
      Link,
    }),
    QueryState: ({ children }) => h('section', { 'data-query': true }, children),
  });
  let seen;
  function Consumer() {
    seen = useBitaKitNavigation();
    return null;
  }
  const view = await mount(
    h(
      framework.BitaKitRuntimeProvider,
      { config: { plugins: [definePlugin({ id: 'todos' })] }, ui: testUI },
      h(Consumer),
    ),
  );
  try {
    assert.equal(seen.pathname, '/todos/42');
    assert.deepEqual(seen.params, { id: '42' });
    assert.equal(seen.Link, Link);
    seen.navigate('/done', { replace: true });
    assert.deepEqual(navigations, [['/done', true]]);
    assert.ok(
      view.container.querySelector('[data-query]'),
      'the query-state adapter wraps the app',
    );
    assert.equal(framework.BitaKitRuntimeProvider.displayName, 'fake.BitaKitRuntimeProvider');
  } finally {
    await view.unmount();
  }
  assert.throws(
    () => framework.BitaKitRuntimeProvider({ children: null }),
    /BitaKitRuntimeProvider needs a configuration/,
  );
});
