import test from 'node:test';
import assert from 'node:assert/strict';
import { FoundationRuntime, Action, createActionList } from '@bitakit/core';
import { betterAuthPlugin } from '../dist/index.js';
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
  const integration = betterAuthPlugin(client);
  const list = createActionList();
  class Logout extends Action {
    constructor({ services }) {
      super({ id: 'logout', title: 'Logout' });
      this.auth = services.auth;
    }
    connect() {
      const sync = () => {
        this.visible = !!this.auth.getSnapshot().user;
      };
      const stop = this.auth.subscribe(sync);
      sync();
      return stop;
    }
    execute() {
      return this.auth.signOut();
    }
  }
  const runtime = new FoundationRuntime(list, { plugins: [integration], actions: [Logout] });
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
  const custom = betterAuthPlugin(client, {
    signOut: async () => {
      override++;
    },
  });
  await custom.services[0].create().signOut();
  assert.equal(override, 1);
  assert.equal(signs, 2);
});
