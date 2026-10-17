import { mount, settle } from './dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement as h } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthClient } from 'better-auth/react';
import { authService, definePlugin, defineService } from '@bitakit/core';
import { BitaKitRuntimeProvider, useBitaKit, useSettingsCatalog } from '@bitakit/ui';
import { betterAuthClient } from '@bitakit/better-auth';
import { organizationBackend, organizationsPlugin } from '@bitakit/organizations';
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

test('independent account profile and security pages preserve native cards and sign-in guards', async () => {
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
    provider: { queryClient, navigate() {}, plugins: [] },
    toastProvider: false,
  });
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: { plugins: [auth.plugin, plugin] },
        services: { [betterAuthClient]: { client: authClient } },
      },
      h('section', { 'data-test-profile': true }, h(plugin.ui.settings.boundary, null, h(plugin.ui.settings.component), h('span', { 'data-protected-extension': true }, 'Profile extension'))),
      h('section', { 'data-test-security': true }, h(plugin.ui.settings.pages[0].boundary, null, h(plugin.ui.settings.pages[0].component), h('span', { 'data-protected-extension': true }, 'Security extension'))),
    ),
  );
  try {
    assert.equal(view.container.querySelector('[role="status"]')?.textContent, 'Checking sign-in…');

    assert.equal(view.container.querySelector('[data-protected-extension]'), null);
    await auth.set({ user: { id: 'user', name: 'Page Tester' }, pending: false, error: null });
    await settle(10);
    assert.equal(view.container.querySelectorAll('[data-protected-extension]').length, 2);
    const headings = texts(view.container, 'h2');
    assert.deepEqual(texts(view.container.querySelector('[data-test-profile]'), 'h2'), [
      'User profile',
    ]);
    assert.ok(
      !view.container.querySelector('[data-test-security]').textContent.includes('User profile'),
    );
    assert.ok(!headings.includes('Profile') && !headings.includes('Security'));
    // The native cards with the signed-in user's data, profile first.
    for (const card of ['User profile', 'Change email', 'Change password', 'Active sessions'])
      assert.ok(headings.includes(card), `${card} in ${headings.join(', ')}`);

    assert.match(view.container.textContent, /Current session/);
    assert.equal(view.container.querySelector('h1'), null, 'the host frame owns the page title');

    await auth.set({ user: null, pending: false, error: null });
    assert.match(view.container.textContent, /Sign in to access these account settings\./);
    assert.equal(view.container.querySelector('a').getAttribute('href'), '/auth/sign-in');
    assert.equal(view.container.querySelectorAll('[data-slot=empty]').length, 2);
    assert.equal(view.container.querySelector('[data-protected-extension]'), null);
    assert.equal(view.container.querySelector('h2'), null);
  } finally {
    await view.unmount();
    queryClient.clear();
  }
});

test('separate organization pages preserve management guards and an independent danger card', async () => {
  const organizations = organizationUIPlugin({ path: false });
  // Better Auth UI provides the native locale the invitation dates are formatted with.
  const account = betterAuthUIPlugin({
    provider: { navigate() {}, plugins: [] },
    toastProvider: false,
    pages: false,
  });
  const urls = [];
  let runtime;
  let catalog;
  function Probe() {
    runtime = useBitaKit().runtime;
    catalog = useSettingsCatalog();
    return null;
  }
  const view = await mount(
    h(
      NuqsTestingAdapter,
      { searchParams: '?tab=members', onUrlUpdate: (event) => urls.push(event.queryString) },
      h(
        BitaKitRuntimeProvider,
        {
          config: { plugins: [organizationsPlugin(), organizations, account] },
          services: {
            [betterAuthClient]: { client: createAuthClient({ baseURL: origin }) },
            [organizationBackend]: createDemoOrganizationBackend(),
          },
        },
        h(Probe),
        h(organizations.ui.settings.boundary, null, h(organizations.ui.settings.component)),
        ...organizations.ui.settings.pages.map((page) => h(page.boundary, { key: page.id }, h(page.component), h('span', { 'data-protected-page': page.id }, 'Extension'))),
      ),
    ),
  );
  try {
    await settle();
    assert.deepEqual(
      catalog.map((section) => [section.path, section.category]),
      [
        ['account', 'account'],
        ['organization', 'organization'],
        ['account/security', 'account'],
        ['organization/members', 'organization'],
        ['account/invitations', 'account'],
      ],
    );
    assert.equal(
      view.container.querySelector('h1'),
      null,
      'the settings host owns the page heading',
    );
    assert.equal(
      view.container.querySelector('h2'),
      null,
      'embedded content does not duplicate headings',
    );
    assert.match(view.container.textContent, /Partner Studio/);
    const deletion = [...view.container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Delete organization',
    );
    assert.equal(deletion.getAttribute('data-variant'), 'destructive');
    assert.equal(deletion.closest('form'), null, 'deletion is outside the save form');
    const save = view.container.querySelector('button[type=submit]');
    assert.ok(save.closest('[data-slot=card]'), 'save belongs inside the profile card');
    assert.notEqual(save.closest('[data-slot=card]'), deletion.closest('[data-slot=card]'));
    assert.match(save.parentElement.className, /justify-end/);
    assert.match(deletion.closest('[data-slot="card"]').textContent, /cannot be undone/);
    const service = runtime.services.organizations;
    await act(async () => {
      await service.accept('demo-incoming');
      await service.setActive('partner');
    });
    await settle();
    assert.match(
      view.container.textContent,
      /You do not have permission to manage this organization/,
    );
    const restricted = view.container.querySelector('[data-slot=empty][role=status]');
    assert.match(restricted.textContent, /Management access required/);
    assert.equal(view.container.querySelector('[data-protected-page=members]'), null);
    assert.ok(restricted.querySelector('[data-slot=empty-description]'));
    assert.ok(
      ![...view.container.querySelectorAll('button')].some(
        (button) => button.textContent === 'Delete organization',
      ),
    );
    await act(() => service.setActive('studio'));
    await settle();
    assert.ok(
      !view.container.textContent.includes(
        'You do not have permission to manage this organization',
      ),
    );
  } finally {
    await view.unmount();
  }
});

test('organization settings leave loading for a signed-out session before mounting protected content', async () => {
  const { SettingsAccountAccess } = await import('../dist/settings/account.js');
  const auth = testAuth({ user: null, pending: true, error: null });
  const plugin = betterAuthUIPlugin({ provider: { navigate() {}, plugins: [] }, toastProvider: false });
  const view = await mount(h(BitaKitRuntimeProvider, {
    config: { plugins: [auth.plugin, plugin] },
    services: { [betterAuthClient]: { client: createAuthClient({ baseURL: origin }) } },
  }, h(SettingsAccountAccess, null, h('p', null, 'Protected settings'))));
  try {
    assert.match(view.container.textContent, /Checking sign-in/);
    await auth.set({ user: null, pending: false, error: null });
    assert.match(view.container.textContent, /Sign in to access/);
    assert.ok(!view.container.textContent.includes('Checking sign-in'));
    assert.ok(!view.container.textContent.includes('Protected settings'));
    await auth.set({ user: { id: 'test' }, pending: false, error: null });
    assert.match(view.container.textContent, /Protected settings/);
  } finally { await view.unmount(); }
});
