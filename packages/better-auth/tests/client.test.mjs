import test from 'node:test';
import assert from 'node:assert/strict';
import { FoundationRuntime, createActionList, defineAction } from '@bitakit/core';
import { betterAuthClient, betterAuthPlugin } from '../dist/index.js';
test('Better Auth integration delegates current session, subscription ownership and sign-out errors', async () => {
  let state = { data: null, isPending: true, error: null },
    signs = 0,
    failure = null;
  const listeners = new Set();
  const client = {
    $store: {
      atoms: {
        session: {
          get: () => state,
          subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      },
    },
    async signOut() {
      signs++;
      return { error: failure };
    },
  };
  const integration = betterAuthPlugin();
  const list = createActionList();
  // Visibility follows the auth service: it exposes subscribe(), so the runtime observes it.
  const Logout = defineAction({
    id: 'logout',
    title: 'Logout',
    visible: ({ services }) => !!services.auth.getSnapshot().user,
    execute: ({ services }) => services.auth.signOut(),
  });
  const runtime = new FoundationRuntime(
    list,
    { plugins: [integration], actions: [Logout] },
    { [betterAuthClient]: { client } },
  );
  const stopList = list.mount();
  const stop = runtime.mount();
  assert.equal(runtime.services.auth.getSnapshot(), runtime.services.auth.getSnapshot());
  assert.equal(list.get('logout').visible, false);
  state = { data: { user: { id: 'one' } }, isPending: false, error: null };
  listeners.forEach((listener) => listener(state));
  assert.equal(list.get('logout').visible, true);
  await list.execute('logout');
  assert.equal(signs, 1);
  failure = new Error('Failed');
  await assert.rejects(runtime.services.auth.signOut(), /Failed/);
  stop();
  stopList();
  assert.equal(listeners.size, 0);
  let override = 0;
  const custom = betterAuthPlugin({
    signOut: async () => {
      override++;
    },
  });
  await custom.services.session.create({ services: { [betterAuthClient]: { client } } }).signOut();
  assert.equal(override, 1);
  assert.equal(signs, 2);
});
