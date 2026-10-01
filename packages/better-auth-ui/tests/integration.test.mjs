import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization, multiSession, twoFactor } from 'better-auth/plugins';
import { createAuthClient } from 'better-auth/react';
import { betterAuthUIPlugin } from '../dist/index.js';
import { twoFactorPlugin } from '@better-auth-ui/heroui/plugins/two-factor';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { organizationPlugin } from '@better-auth-ui/heroui/plugins/organization';
import { createActionList, FoundationRuntime } from '@bitakit/core';
import { createAppPreferences, SettingsSection } from '@bitakit/app-preferences/core';

test('Foundation plugin uses native paths, keeps full provider options and cleans settings', () => {
  const authClient = createAuthClient({ baseURL: 'http://localhost:9999' });
  const catalog = createAppPreferences({
    storage: { load: async () => ({ value: undefined, writable: true }), save: async () => {} },
  });
  catalog.add(new SettingsSection({ id: 'account', title: 'Account' }));
  const plugin = betterAuthUIPlugin({
    provider: {
      authClient,
      navigate: () => {},
      plugins: [organizationPlugin(), twoFactorPlugin()],
      basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
      socialProviders: ['google', 'github'],
      additionalFields: [{ name: 'department', type: 'string', label: 'Department' }],
    },
    settings: {
      catalog,
      section: 'account',
      entries: [{ id: 'auth-security', title: 'Security', view: 'security' }],
    },
  });
  assert.ok(plugin.pages.some((p) => p.path === '/auth/accept-invitation'));
  assert.ok(plugin.pages.some((p) => p.path === '/auth/two-factor'));
  assert.ok(plugin.pages.some((p) => p.path === '/organization/people'));
  assert.ok(plugin.pages.some((p) => p.path === '/settings/auth-security'));
  const runtime = new FoundationRuntime(createActionList(), { plugins: [plugin] });
  const cleanup = runtime.mount();
  assert.equal(runtime.services['better-auth-ui'].authClient, authClient);
  assert.equal(runtime.services['better-auth-ui'].additionalFields[0].name, 'department');
  assert.ok(catalog.getSection('auth-security'));
  cleanup();
  assert.equal(catalog.getSection('auth-security'), undefined);
});

test('real Better Auth flows in isolated memory: login, profile, org, invitation, reset, sessions', async () => {
  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
  };
  let resetURL;
  let invitation;
  const auth = betterAuth({
    baseURL: 'http://localhost:9999',
    secret: 'test-only-secret-longer-than-thirty-two-characters',
    database: memoryAdapter(database),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ url }) => {
        resetURL = url;
      },
    },
    plugins: [
      organization({
        sendInvitationEmail: async (data) => {
          invitation = data;
        },
      }),
      multiSession(),
    ],
  });
  const request = async (path, body, cookie = '') => {
    const response = await auth.handler(
      new Request('http://localhost:9999/api/auth' + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:9999', cookie },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    const result = await response.json();
    assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(result)}`);
    const cookies = response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return { result, cookie: cookies || cookie };
  };
  const password = 'Local-test-password123!';
  const owner = await request('/sign-up/email', {
    email: 'owner@example.test',
    name: 'Owner',
    password,
  });
  const login = await request('/sign-in/email', { email: 'owner@example.test', password });
  await request('/update-user', { name: 'Updated Owner' }, login.cookie);
  const org = await request(
    '/organization/create',
    { name: 'Local Organization', slug: 'local-org' },
    login.cookie,
  );
  const active = await request(
    '/organization/set-active',
    { organizationId: org.result.id },
    login.cookie,
  );
  await request(
    '/organization/invite-member',
    { organizationId: org.result.id, email: 'member@example.test', role: 'member' },
    active.cookie,
  );
  assert.ok(invitation.id);
  const member = await request('/sign-up/email', {
    email: 'member@example.test',
    name: 'Member',
    password,
  });
  await request('/organization/accept-invitation', { invitationId: invitation.id }, member.cookie);
  const members = await request(
    '/organization/list-members?organizationId=' + org.result.id,
    null,
    active.cookie,
  );
  assert.equal(members.result.members.length, 2);
  const sessions = await request('/list-sessions', null, login.cookie);
  assert.ok(sessions.result.length >= 1);
  await request('/request-password-reset', {
    email: 'owner@example.test',
    redirectTo: 'http://localhost:9999/auth/reset-password',
  });
  assert.ok(resetURL);
  const token = new URL(resetURL).pathname.split('/').pop();
  await request('/reset-password', { token, newPassword: 'Changed-test-password123!' });
  await request('/sign-in/email', {
    email: 'owner@example.test',
    password: 'Changed-test-password123!',
  });
  await request('/sign-out', {}, member.cookie);
});

test('public UI and plugin exports are the external dependency, without vendored sources', async () => {
  const original = await import('@better-auth-ui/heroui');
  const adapter = await import('../dist/index.js');
  for (const [name, value] of Object.entries(original)) assert.equal(adapter[name], value, name);
  const originalPlugins = await import('@better-auth-ui/heroui/plugins');
  const plugins = await import('@bitakit/better-auth-ui/plugins');
  for (const [name, value] of Object.entries(originalPlugins))
    assert.equal(plugins[name], value, name);
  const { readFile } = await import('node:fs/promises');
  const entry = await readFile(new URL('../src/upstream/index.ts', import.meta.url), 'utf8');
  assert.match(entry, /export \* from ['"]@better-auth-ui\/heroui\/plugins['"]/);

});


test('native two-factor enrollment, login challenge and recovery run without host logic', async () => {
  const database = { user: [], session: [], account: [], verification: [], twoFactor: [] };
  const auth = betterAuth({
    baseURL: 'http://localhost:9999',
    secret: 'test-only-secret-longer-than-thirty-two-characters',
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    plugins: [twoFactor({ issuer: 'SaaS Foundation' })],
  });
  const request = async (path, body, cookie = '') => {
    const response = await auth.handler(new Request('http://localhost:9999/api/auth' + path, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:9999', cookie },
      body: JSON.stringify(body),
    }));
    assert.equal(response.status, 200, path);
    return { data: await response.json(), cookie: [...new Map([...cookie.split('; ').filter(Boolean), ...response.headers.getSetCookie().map(c => c.split(';')[0])].map(c => [c.slice(0, c.indexOf('=')), c])).values()].join('; ') };
  };
  const credentials = { email: 'two-factor@example.test', password: 'Isolated-test-password123!' };
  const signup = await request('/sign-up/email', { ...credentials, name: 'Two Factor Test' });
  const enrollment = await request('/two-factor/enable', { password: credentials.password }, signup.cookie);
  assert.equal(database.user[0].twoFactorEnabled, false);
  const secret = new URL(enrollment.data.totpURI).searchParams.get('secret');
  await request('/two-factor/verify-totp', { code: await createOTP(new TextDecoder().decode(base32.decode(secret))).totp() }, enrollment.cookie);
  assert.equal(database.user[0].twoFactorEnabled, true);
  const login = await request('/sign-in/email', credentials);
  assert.equal(login.data.twoFactorRedirect, true);
  assert.equal(login.data.token, undefined);
  const verified = await request('/two-factor/verify-backup-code', { code: enrollment.data.backupCodes[0] }, login.cookie);
  assert.ok(verified.data.token);
});

test('standard composition shares one client between auth service and UI and preserves overrides', async () => {
  const { createBetterAuthIntegration, betterAuthUIService } = await import('../dist/index.js');
  const { createBetterAuthClient } = await import('@bitakit/better-auth/client');
  const { authService, getService } = await import('@bitakit/core');
  const client = createBetterAuthClient({ baseURL: 'http://localhost:9999' });
  const integration = createBetterAuthIntegration({ client, provider: { plugins: [], redirectTo: '/contents' }, organizations: { path: false, groups: [] } });
  assert.equal(integration.client, client);
  const runtime = new FoundationRuntime(createActionList(), { plugins: integration.plugins });
  const dispose = runtime.mount();
  const config = getService(runtime.services, betterAuthUIService);
  assert.equal(config.authClient, client);
  assert.deepEqual(config.plugins, []);
  assert.equal(config.redirectTo, '/contents');
  const auth = getService(runtime.services, authService);
  assert.equal(auth.getSnapshot().user, null);
  assert.equal(typeof auth.subscribe, 'function');
  assert.equal(integration.plugins.flatMap(plugin => plugin.providers ?? []).length, 1);
  assert.deepEqual(integration.plugins.map(plugin => plugin.id), ['better-auth', 'better-auth-ui', 'organizations', 'organizations-ui']);
  const { organizationService } = await import('@bitakit/organizations');
  assert.ok(getService(runtime.services, organizationService));
  dispose();
});

test('native toast surface can be omitted without changing the native auth provider', () => {
  const client = createAuthClient({ baseURL: 'http://localhost:9999' });
  const config = { authClient: client, navigate() {}, plugins: [] };
  for (const enabled of [true, false]) {
    const plugin = betterAuthUIPlugin({ provider: config, toastProvider: enabled });
    const Provider = plugin.providers[0].component;
    let result;
    // Inspect the composed element within a React render so its translation hook runs normally.
    function CompositionProbe() {
      result = Provider({ children: 'content' });
      return null;
    }
    renderToStaticMarkup(createElement(CompositionProbe));
    assert.equal(result.props.authClient, client);
    assert.equal(result.props.children[0], 'content');
    assert.equal(Boolean(result.props.children[1]), enabled);
  }
});
