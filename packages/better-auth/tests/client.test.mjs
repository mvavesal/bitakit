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
  await stop();
  await stopList();
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

test('native session responses retain all sessions while empty user agents have a safe display fallback', async () => {
  const { createBetterAuthClient } = await import('../dist/client.js');
  const { default: Bowser } = await import('bowser');
  const sessions = [
    { id: 'null', token: 'one', userAgent: null },
    { id: 'empty', token: 'two', userAgent: '' },
    { id: 'space', token: 'three', userAgent: ' ' },
    { id: 'known', token: 'four', userAgent: 'Mozilla/5.0' },
  ];
  let delegated = false;
  const client = createBetterAuthClient({
    baseURL: 'http://auth.example.test',
    fetchOptions: {
      customFetchImpl: async () => Response.json(sessions),
      onSuccess(context) {
        delegated = true;
        assert.equal(context.data.length, 4);
      },
    },
  });
  const result = await client.listSessions();
  assert.equal(delegated, true);
  assert.deepEqual(
    result.data.map(({ id, token }) => ({ id, token })),
    sessions.map(({ id, token }) => ({ id, token })),
  );
  for (const session of result.data) assert.doesNotThrow(() => Bowser.parse(session.userAgent));
  assert.equal(result.data[3].userAgent, sessions[3].userAgent);
  // The hook must not alter unrelated provider payloads.
  const unrelated = await client.$fetch('/some-other-endpoint');
  assert.equal(unrelated.data[0].userAgent, null);
});
