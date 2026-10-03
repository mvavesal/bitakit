import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

/** Explicit native auth configuration in an otherwise unmodified generated app. */
export async function configureAuthFixture(target, archives) {
  const file = path.join(target, 'package.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  for (const name of ['better-auth', 'better-auth-ui', 'organizations'])
    manifest.dependencies[`@bitakit/${name}`] = archives[`@bitakit/${name}`];
  Object.assign(manifest.dependencies, { 'better-auth': '^1.7.5', '@better-auth/api-key': '^1.7.5', '@tanstack/react-query': '^5.0.0' });
  Object.assign(manifest.overrides ??= {}, archives);
  await writeFile(file, JSON.stringify(manifest, null, 2));
  const files = {
    'src/services/auth-client.ts': `import { defineService } from '@bitakit/core';
import { betterAuthClient } from '@bitakit/better-auth';
import { createBetterAuthClient } from '@bitakit/better-auth/client';
export default defineService(() => ({ client: createBetterAuthClient() }), { provides: betterAuthClient });
`,
    'src/configs/better-auth-ui.ts': `import { defineConfig } from '@bitakit/core';
import { QueryClient } from '@tanstack/react-query';
import { organizationPlugin } from '@bitakit/better-auth-ui/plugins/organization';
import { multiSessionPlugin } from '@bitakit/better-auth-ui/plugins/multi-session';
import { twoFactorPlugin } from '@bitakit/better-auth-ui/plugins/two-factor';
export default defineConfig({ defaults: {
  toastProvider: false,
  provider: {
    queryClient: new QueryClient(),
    plugins: [organizationPlugin({ teams: true }), multiSessionPlugin(), twoFactorPlugin()],
    basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
    redirectTo: '/checks',
    socialProviders: [],
    emailAndPassword: { enabled: true, forgotPassword: false },
  },
} });
`,
    'src/app/api/auth/[...all]/route.ts': `import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization, multiSession, twoFactor } from 'better-auth/plugins';
const auth = betterAuth({
  baseURL: process.env.BITAKIT_TEST_ORIGIN || 'http://localhost:4100',
  secret: randomBytes(32).toString('hex'),
  database: memoryAdapter({ user: [], session: [], account: [], verification: [], organization: [], member: [], invitation: [], team: [], teamMember: [], twoFactor: [] }),
  emailAndPassword: { enabled: true },
  plugins: [organization({ teams: { enabled: true } }), multiSession(), twoFactor()],
});
function handler(request: Request) {
  if (process.env.BITAKIT_TEST_AUTH !== '1') return new Response('Test auth is disabled', { status: 404 });
  return auth.handler(request);
}
export { handler as GET, handler as POST };
`,
    'src/app/(app)/checks/page.tsx': `'use client';
import { lazy, Suspense, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@bitakit/ui';
import { Auth, UserButton } from '@bitakit/better-auth-ui';
import { OrganizationSwitcher } from '@bitakit/better-auth-ui/plugins/organization';
const Lazy = lazy(() => import('fixture-plugin/lazy'));
export default function Checks() {
  const auth = useAuth();
  const [show, setShow] = useState(false);
  if (auth.pending) return <p>Loading session</p>;
  return <section>
    <h1>Native integration checks</h1>
    <p>Isolated local test accounts. Data is temporary; no email is sent.</p>
    {auth.user ? <><UserButton /><OrganizationSwitcher aria-label="Switch organization" /></> : <Auth view="signIn" />}
    <Link href="/settings/account">Account settings</Link>
    <Link href="/settings/shell">Appearance settings</Link>
    <button onClick={() => setShow(true)}>Load fixture plugin</button>
    {show && <Suspense fallback={<p>Loading plugin</p>}><Lazy /></Suspense>}
  </section>;
}
`,
    'fixture-plugin/package.json': JSON.stringify({
      name: 'fixture-plugin', version: '1.0.0', type: 'module',
      exports: { './package.json': './package.json', './styles.css': './styles.css', './lazy': './lazy.js' },
      bitakit: { styles: './styles.css' }, sideEffects: ['./styles.css'],
    }),
    'fixture-plugin/styles.css': '@layer components { .fixture-plugin { padding: 1rem; } }',
    'fixture-plugin/lazy.js': "import { createElement } from 'react'; export default function Fixture() { return createElement('p', { className: 'fixture-plugin' }, 'Lazy plugin ready'); }",
  };
  manifest.dependencies['fixture-plugin'] = 'file:./fixture-plugin';
  await writeFile(file, JSON.stringify(manifest, null, 2));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(target, name)), { recursive: true });
    await writeFile(path.join(target, name), content);
  }
  await writeFile(path.join(target, 'src/fixture-plugin.d.ts'), "declare module 'fixture-plugin/lazy' { const component: import('react').ComponentType; export default component; }\n");
}

export async function verifyAuthStyles(page, url, artifacts) {
  await page.goto(url + '/checks');
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  const before = await page.locator('.button--primary').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, height: parseFloat(style.height) };
  });
  assert.notEqual(before.background, 'rgba(0, 0, 0, 0)');
  assert.notEqual(before.background, before.color);
  assert.ok(before.height >= 32);
  const email = `fixture-${Date.now()}@example.test`;
  const response = await page.request.post(url + '/api/auth/sign-up/email', {
    headers: { origin: url }, data: { name: 'Fixture User', email, password: 'Fixture-password-2026!' },
  });
  assert.equal(response.ok(), true, await response.text());
  await page.reload();
  await page.getByRole('button', { name: 'Switch organization', exact: true }).waitFor();
  for (const dark of [false, true]) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark);
      await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
      await page.getByRole('menu').waitFor();
      const menu = await page.getByRole('menu').evaluate((element) => ({
        padding: parseFloat(getComputedStyle(element).paddingTop),
        itemPadding: parseFloat(getComputedStyle(element.querySelector('[role="menuitem"]')).paddingLeft),
      }));
      assert.ok(menu.padding > 0, JSON.stringify(menu));
      assert.ok(menu.itemPadding > 0, JSON.stringify(menu));
      await page.screenshot({ path: path.join(artifacts, `menu-${dark ? 'dark' : 'light'}-${width}.png`) });
      await page.keyboard.press('Escape');
    }
  }
  await page.getByRole('button', { name: 'Load fixture plugin' }).click();
  await page.getByText('Lazy plugin ready').waitFor();
  assert.equal(await page.locator('.fixture-plugin').evaluate((e) => getComputedStyle(e).padding), '16px');
  await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
  assert.ok(await page.getByRole('menu').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop)) > 0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Account settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Account', exact: true }).waitFor();
  await page.locator('input[type="password"]').first().waitFor();
  const input = await page.locator('input[type="password"]').first().evaluate((element) => {
    const container = element.closest('[data-slot="input-group"]') || element;
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert.ok(input.width > 100 && input.height >= 28, JSON.stringify(input));
  await page.screenshot({ path: path.join(artifacts, 'account-settings.png'), fullPage: true });
  await page.reload();
  await page.getByRole('heading', { name: 'Account', exact: true }).waitFor();
}
