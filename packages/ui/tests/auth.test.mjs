import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FoundationRuntime, createActionList } from '@bitakit/core';
import { ActionProvider } from '../dist/actions/index.js';
import { AuthBoundary, useAuth } from '../dist/index.js';
import { FoundationContext } from '../dist/providers/foundation-context.js';

const dom = new JSDOM('<html><body></body></html>', {
  url: 'https://app.test/customers?view=all#new',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture(overrides = {}) {
  let snapshot = { user: null, pending: true, error: null };
  const listeners = new Set(),
    navigations = [];
  const service = {
    paths: { signIn: '/login', afterSignIn: '/dashboard', afterSignOut: '/' },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signOut() {},
    ...overrides,
  };
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    services: [{ id: 'auth', create: () => service }],
  });
  const stop = runtime.mount();
  const host = document.createElement('div'),
    root = createRoot(host);
  const navigate = (href) => navigations.push(href);
  function Context({ children }) {
    const [signOutIntent, setSignOutIntent] = useState(null);
    return h(
      FoundationContext.Provider,
      { value: { runtime, signOutIntent, setSignOutIntent } },
      children,
    );
  }
  const tree = (children) =>
    h(
      StrictMode,
      null,
      h(ActionProvider, { actions: list, navigate, shortcuts: false }, h(Context, null, children)),
    );
  return {
    service,
    runtime,
    host,
    root,
    tree,
    listeners,
    navigations,
    stop,
    set(change) {
      snapshot = { ...snapshot, ...change };
      listeners.forEach((listener) => listener());
    },
    async close() {
      await act(async () => root.unmount());
      stop();
      assert.equal(listeners.size, 0);
    },
  };
}

test('AuthBoundary waits for session resolution, handles errors, and redirects once with a safe return path', async () => {
  const f = fixture();
  try {
    await act(async () =>
      f.root.render(
        f.tree(
          h(
            AuthBoundary,
            {
              pending: 'Loading',
              unauthenticated: 'Signing in',
              renderError: () => 'Session error',
            },
            'Private content',
          ),
        ),
      ),
    );
    assert.equal(f.host.textContent, 'Loading');
    assert.deepEqual(f.navigations, []);
    await act(async () => f.set({ pending: false, error: new Error('network') }));
    assert.equal(f.host.textContent, 'Session error');
    assert.deepEqual(f.navigations, []);
    await act(async () => f.set({ error: null, user: { id: 'one' } }));
    assert.equal(f.host.textContent, 'Private content');
    await act(async () => f.set({ user: null }));
    assert.equal(f.host.textContent, 'Signing in');
    assert.deepEqual(f.navigations, ['/login?returnTo=%2Fcustomers%3Fview%3Dall%23new']);
  } finally {
    await f.close();
  }
});

test('SDK-native login gets the normalized destination; failures can render and recover', async () => {
  const targets = [];
  const f = fixture({
    async signIn(options) {
      targets.push(options);
      throw new Error('provider');
    },
  });
  try {
    f.set({ pending: false });
    await act(async () =>
      f.root.render(
        f.tree(
          h(
            AuthBoundary,
            {
              returnTo: 'https://evil.test',
              renderError: () => 'Login failed',
            },
            'Private',
          ),
        ),
      ),
    );
    assert.deepEqual(targets, [{ returnTo: '/dashboard' }]);
    assert.equal(f.host.textContent, 'Login failed');
    assert.deepEqual(f.navigations, []);
    await act(async () => f.set({ user: { id: 'one' } }));
    assert.equal(f.host.textContent, 'Private');
  } finally {
    await f.close();
  }
});

test('login pages do not loop and redirect=false leaves unauthenticated rendering to the host', async () => {
  const f = fixture();
  try {
    f.set({ pending: false });
    await act(async () =>
      f.root.render(
        f.tree(h(AuthBoundary, { redirect: false, unauthenticated: 'Login' }, 'Private')),
      ),
    );
    assert.equal(f.host.textContent, 'Login');
    assert.deepEqual(f.navigations, []);
    window.history.replaceState(null, '', '/login');
    await act(async () =>
      f.root.render(f.tree(h(AuthBoundary, { unauthenticated: 'Login' }, 'Private'))),
    );
    assert.deepEqual(f.navigations, []);
  } finally {
    window.history.replaceState(null, '', '/customers?view=all#new');
    await f.close();
  }
});

test('useAuth delegates sign-out and navigates only after success while the adapter remains active', async () => {
  let current,
    finish,
    fail = true;
  const f = fixture({
    async signOut() {
      if (fail) throw new Error('sign-out failed');
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  function Consumer() {
    current = useAuth();
    return null;
  }
  try {
    await act(async () => f.root.render(f.tree(h(Consumer))));
    await assert.rejects(current.signOut(), /sign-out failed/);
    assert.deepEqual(f.navigations, []);
    fail = false;
    let result = current.signOut();
    finish();
    await result;
    assert.deepEqual(f.navigations, ['/']);
    result = current.signOut();
    await act(async () => f.stop());
    finish();
    await result;
    assert.deepEqual(f.navigations, ['/']);
  } finally {
    await f.close();
  }
});

test('missing login configuration is explicit rather than silently navigating to an invented path', async () => {
  const f = fixture({ paths: undefined });
  try {
    f.set({ pending: false });
    await act(async () =>
      f.root.render(f.tree(h(AuthBoundary, { renderError: (error) => error.message }, 'Private'))),
    );
    assert.match(f.host.textContent, /Configure auth paths/);
    assert.deepEqual(f.navigations, []);
  } finally {
    await f.close();
  }
});

test('successful sign-out chooses afterSignOut while a protected boundary observes session removal', async () => {
  let current;
  const f = fixture({
    async signOut() {
      f.set({ user: null });
    },
  });
  function Consumer() {
    current = useAuth();
    return h(AuthBoundary, null, 'Private');
  }
  try {
    f.set({ pending: false, user: { id: 'one' } });
    await act(async () => f.root.render(f.tree(h(Consumer))));
    await act(async () => current.signOut());
    assert.deepEqual(f.navigations, ['/']);
    window.history.replaceState(null, '', '/another-private-page');
    await act(async () => f.root.render(f.tree(h(Consumer))));
    assert.equal(f.navigations.at(-1), '/login?returnTo=%2Fanother-private-page');
  } finally {
    window.history.replaceState(null, '', '/customers?view=all#new');
    await f.close();
  }
});
