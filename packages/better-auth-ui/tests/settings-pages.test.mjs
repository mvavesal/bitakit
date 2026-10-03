import { mount, settle } from './dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement as h } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthClient } from 'better-auth/react';
import {
  FoundationProvider,
  authService,
  definePlugin,
  defineService,
  useFoundation,
  useSettingsCatalog,
} from '@bitakit/ui';
import { organizationsPlugin } from '@bitakit/organizations';
import { createDemoOrganizationBackend } from '@bitakit/organizations/demo';
import { betterAuthUIPlugin } from '../dist/index.js';
import { organizationUIPlugin } from '../dist/organizations.js';

const origin = 'http://localhost:9999';
const userAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const texts = (container, selector) =>
  [...container.querySelectorAll(selector)].map((node) => node.textContent);
const tabs = (container) =>
  [...container.querySelectorAll('[role="tablist"]')[0].querySelectorAll('[role="tab"]')].map(
    (tab) =>
      `${tab.textContent}${tab.getAttribute('aria-selected') === 'true' ? ' (selected)' : ''}`,
  );
const press = (container, label) =>
  act(async () =>
    [...container.querySelectorAll('[role="tab"]')]
      .find((tab) => tab.textContent === label)
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })),
  );

/** An `auth` contract whose session the test switches; the page reads it through useAuth. */
function testAuth(initial) {
  let snapshot = initial;
  const listeners = new Set();
  const service = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signOut() {},
  };
  return {
    plugin: definePlugin({
      id: 'test-auth',
      services: [defineService(() => service, { provides: authService })],
    }),
    set: (next) =>
      act(async () => {
        snapshot = next;
        listeners.forEach((listener) => listener());
      }),
  };
}

test('the account settings page shows profile and security when signed in, the sign-in prompt otherwise', async () => {
  // A real Better Auth handler in memory feeds the native cards; no network, no shared data.
  const server = betterAuth({
    baseURL: origin,
    secret: 'test-only-secret-longer-than-thirty-two-characters',
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
  });
  const signUp = await server.handler(
    new Request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'user-agent': userAgent },
      body: JSON.stringify({
        email: 'account-page@example.test',
        name: 'Page Tester',
        password: 'Isolated-test-password123!',
      }),
    }),
  );
  const cookie = signUp.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const authClient = createAuthClient({
    baseURL: origin,
    fetchOptions: {
      customFetchImpl: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('cookie', cookie);
        headers.set('origin', origin);
        headers.set('user-agent', userAgent);
        return server.handler(new Request(input, { ...init, headers }));
      },
    },
  });
  const auth = testAuth({ user: null, pending: true, error: null });
  const queryClient = new QueryClient();
  const plugin = betterAuthUIPlugin({
    provider: { authClient, queryClient, navigate() {}, plugins: [] },
    toastProvider: false,
  });
  const view = await mount(
    h(
      FoundationProvider,
      { config: { plugins: [auth.plugin, plugin] } },
      h(plugin.ui.settings.component),
    ),
  );
  try {
    assert.equal(view.container.querySelector('[role="status"]')?.textContent, 'Checking sign-in…');

    await auth.set({ user: { id: 'user', name: 'Page Tester' }, pending: false, error: null });
    await settle(10);
    const headings = texts(view.container, 'h2');
    assert.ok(headings.indexOf('Profile') < headings.indexOf('Security'), headings.join(', '));
    // The native cards with the signed-in user's data, profile first.
    for (const card of ['User profile', 'Change email', 'Change password', 'Active sessions'])
      assert.ok(headings.includes(card), `${card} in ${headings.join(', ')}`);
    assert.ok(headings.indexOf('User profile') < headings.indexOf('Security'));
    assert.ok(headings.indexOf('Security') < headings.indexOf('Change password'));
    assert.match(view.container.textContent, /Current session/);
    assert.equal(view.container.querySelector('h1'), null, 'the host frame owns the page title');

    await auth.set({ user: null, pending: false, error: null });
    assert.match(view.container.textContent, /^Sign in to access these account settings\./);
    assert.equal(view.container.querySelector('a').getAttribute('href'), '/auth/sign-in');
    assert.equal(view.container.querySelector('h2'), null);
  } finally {
    await view.unmount();
    queryClient.clear();
  }
});

test('the organization settings page offers members only to managers and keeps its tab in the URL', async () => {
  const organizations = organizationUIPlugin({ path: false });
  // Better Auth UI provides the native locale the invitation dates are formatted with.
  const account = betterAuthUIPlugin({
    provider: { authClient: createAuthClient({ baseURL: origin }), navigate() {}, plugins: [] },
    toastProvider: false,
    pages: false,
  });
  const urls = [];
  let runtime;
  let catalog;
  function Probe() {
    runtime = useFoundation().runtime;
    catalog = useSettingsCatalog();
    return null;
  }
  const view = await mount(
    h(
      NuqsTestingAdapter,
      { searchParams: '?tab=members', onUrlUpdate: (event) => urls.push(event.queryString) },
      h(
        FoundationProvider,
        {
          config: {
            plugins: [organizationsPlugin(createDemoOrganizationBackend), organizations, account],
          },
        },
        h(Probe),
        h(organizations.ui.settings.component),
      ),
    ),
  );
  try {
    await settle();
    // What the host settings UI renders: one page per plugin, under /settings/<path>.
    assert.deepEqual(
      catalog.map((section) => [
        section.id,
        section.path,
        section.title,
        section.category,
        section.fields.length,
        section.component ===
          (section.id === 'organizations-ui' ? organizations : account).ui.settings.component,
      ]),
      [
        ['better-auth-ui', 'account', 'Account', 'account', 0, true],
        ['organizations-ui', 'organization', 'Organization', 'organization', 0, true],
      ],
    );
    // The demo viewer owns the active organization, so the URL's members tab is offered.
    assert.deepEqual(tabs(view.container), [
      'Profile',
      'Members and invitations (selected)',
      'Invitations for me',
    ]);
    assert.deepEqual(texts(view.container, 'h2'), ['Members']);

    await press(view.container, 'Invitations for me');
    assert.equal(urls.at(-1), '?tab=invitations');
    assert.deepEqual(texts(view.container, 'h2'), ['Invitations for me']);
    assert.match(view.container.textContent, /Partner Studio/);

    await press(view.container, 'Profile');
    assert.equal(urls.at(-1), '', 'the default tab leaves the URL clean');
    assert.deepEqual(texts(view.container, 'h2'), ['Organization settings']);
    assert.equal(view.container.querySelector('h1'), null, 'the host frame owns the page title');

    await press(view.container, 'Members and invitations');
    assert.equal(urls.at(-1), '?tab=members');
    const service = runtime.services.organizations;
    await act(async () => {
      await service.accept('demo-incoming');
      await service.setActive('partner');
    });
    await settle();
    // A plain member: no members tab, and the page falls back to the profile.
    assert.deepEqual(tabs(view.container), ['Profile (selected)', 'Invitations for me']);
    assert.deepEqual(texts(view.container, 'h2'), ['Organization profile']);

    await act(() => service.setActive('studio'));
    await settle();
    assert.deepEqual(tabs(view.container), [
      'Profile',
      'Members and invitations (selected)',
      'Invitations for me',
    ]);
  } finally {
    await view.unmount();
  }
});
