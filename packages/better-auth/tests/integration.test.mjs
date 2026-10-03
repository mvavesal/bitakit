import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '@bitakit/core';
import { betterAuthClient, betterAuthPlugin } from '../dist/index.js';

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
  const plugin = betterAuthPlugin({
    paths,
    signIn: async (options) => {
      requests.push(options);
    },
  });
  const runtime = createRuntime(
    { plugins: [plugin] },
    { services: { [betterAuthClient]: { client } } },
  );
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
    () => betterAuthPlugin({ paths: { ...paths, signIn: '//evil.test' } }),
    /root-relative/,
  );
});

test('Better Auth requires the host client through the better-auth-client contract', () => {
  assert.equal(betterAuthClient, 'better-auth-client');
  assert.throws(
    () => createRuntime({ plugins: [betterAuthPlugin()] }).mount(),
    /requires service "better-auth-client"/,
  );
});
