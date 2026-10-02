import test from 'node:test';
import assert from 'node:assert/strict';
import { FoundationRuntime, createActionList } from '@bitakit/core';
import { betterAuthPlugin } from '../dist/index.js';

test('Better Auth accepts external navigation paths and an optional native login delegate', async () => {
  const paths = { signIn: '/account/login', afterSignIn: '/workspace', afterSignOut: '/' };
  const requests = [];
  const client = {
    $store: {
      atoms: {
        session: {
          get: () => ({ data: null, isPending: false, error: null }),
          subscribe: () => () => {},
        },
      },
    },
    async signOut() {
      return { error: null };
    },
  };
  const plugin = betterAuthPlugin(client, {
    paths,
    signIn: async (options) => {
      requests.push(options);
    },
  });
  const runtime = new FoundationRuntime(createActionList(), { plugins: [plugin] });
  const stop = runtime.mount();
  try {
    assert.deepEqual(runtime.services.auth.paths, paths);
    assert.ok(Object.isFrozen(runtime.services.auth.paths));
    await runtime.services.auth.signIn({ returnTo: '/customers' });
    assert.deepEqual(requests, [{ returnTo: '/customers' }]);
  } finally {
    stop();
  }
  assert.throws(
    () => betterAuthPlugin(client, { paths: { ...paths, signIn: '//evil.test' } }),
    /root-relative/,
  );
});
