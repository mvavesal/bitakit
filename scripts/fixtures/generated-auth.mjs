import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

/**
 * Explicit native auth configuration in an otherwise unmodified generated app. The Better Auth
 * packages live in the bitakit-integrations repository, so they come from npm at the current
 * release line; the overrides still point every @bitakit dependency of theirs at the local
 * archives, which checks the published integrations against this checkout.
 */
export async function configureAuthFixture(target, archives) {
  const file = path.join(target, 'package.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  const core = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, '../../packages/core/package.json'), 'utf8'),
  );
  const releaseLine = `^${core.version.split('.').slice(0, 2).join('.')}.0`;
  for (const name of ['better-auth', 'better-auth-ui', 'organizations', 'devtools'])
    manifest.dependencies[`@bitakit/${name}`] = archives[`@bitakit/${name}`] ?? releaseLine;
  Object.assign(manifest.dependencies, {
    'better-auth': '^1.7.5',
    '@better-auth/api-key': '^1.7.5',
  });
  Object.assign((manifest.overrides ??= {}), archives);
  await writeFile(file, JSON.stringify(manifest, null, 2));
  const files = {
    'src/components/auth-providers.tsx': `'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createBetterAuthIntegration } from '@bitakit/better-auth-ui';
import { BitaKitProvider } from '../bitakit.gen';
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [native] = useState(() => createBetterAuthIntegration({
    toastProvider: false,
    provider: {
      navigate: ({ to, replace }) => replace ? router.replace(to) : router.push(to),
      basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
      redirectTo: '/checks',
      socialProviders: [],
      emailAndPassword: { forgotPassword: false },
    },
  }));
  return <BitaKitProvider additionalPlugins={native.plugins}>{children}</BitaKitProvider>;
}
`,
    'src/app/api/auth/[...all]/route.ts': `import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization, multiSession, twoFactor } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
const auth = betterAuth({
  baseURL: process.env.BITAKIT_TEST_ORIGIN || 'http://localhost:4100',
  secret: randomBytes(32).toString('hex'),
  database: memoryAdapter({ user: [], session: [], account: [], verification: [], organization: [], member: [], invitation: [], team: [], teamMember: [], twoFactor: [], apikey: [] }),
  emailAndPassword: { enabled: true },
  plugins: [organization({ teams: { enabled: true } }), multiSession(), twoFactor(), apiKey()],
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
  return <section className="flex flex-col gap-4">
    <h1>Native integration checks</h1>
    <p>Isolated local test accounts. Data is temporary; no email is sent.</p>
    {auth.user ? <div className="flex flex-wrap gap-2"><UserButton /><OrganizationSwitcher aria-label="Switch organization" /></div> : <Auth view="signIn" />}
    <Link href="/settings/account/security">Security settings</Link>
    <Link href="/settings/shell">Appearance settings</Link>
    <button onClick={() => setShow(true)}>Load fixture plugin</button>
    {show && <Suspense fallback={<p>Loading plugin</p>}><Lazy /></Suspense>}
  </section>;
}
`,
    'fixture-plugin/package.json': JSON.stringify({
      name: 'fixture-plugin',
      version: '1.0.0',
      type: 'module',
      exports: {
        './package.json': './package.json',
        './styles.css': './styles.css',
        './lazy': './lazy.js',
      },
      bitakit: { styles: './styles.css' },
      sideEffects: ['./styles.css'],
    }),
    'fixture-plugin/styles.css': '@layer components { .fixture-plugin { padding: 1rem; } }',
    'fixture-plugin/lazy.js':
      "import { createElement } from 'react'; export default function Fixture() { return createElement('p', { className: 'fixture-plugin' }, 'Lazy plugin ready'); }",
  };
  manifest.dependencies['fixture-plugin'] = 'file:./fixture-plugin';
  await writeFile(file, JSON.stringify(manifest, null, 2));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(target, name)), { recursive: true });
    await writeFile(path.join(target, name), content);
  }
  const layout = path.join(target, 'src/app/layout.tsx');
  await writeFile(
    layout,
    (await readFile(layout, 'utf8'))
      .replace(
        "import { BitaKitProvider } from '@/bitakit.gen';",
        "import { Providers } from '@/components/auth-providers';",
      )
      .replaceAll('<BitaKitProvider>', '<Providers>')
      .replaceAll('</BitaKitProvider>', '</Providers>'),
  );
  await writeFile(
    path.join(target, 'src/fixture-plugin.d.ts'),
    "declare module 'fixture-plugin/lazy' { const component: import('react').ComponentType; export default component; }\n",
  );
}

export async function verifyAuthStyles(page, url, artifacts, developmentTarget) {
  await page.goto(url + '/checks');
  await page.getByRole('button', { name: /^Sign in$/i }).waitFor();
  const layers = await page.evaluate(() => {
    const result = [];
    function scan(rules) {
      for (const rule of rules) {
        const match = /^@layer\s+([^;{]+)/.exec(rule.cssText);
        if (match)
          for (const name of match[1].split(',').map((value) => value.trim()))
            if (!result.includes(name)) result.push(name);
        if (rule.styleSheet) scan(rule.styleSheet.cssRules);
      }
    }
    for (const sheet of document.styleSheets) scan(sheet.cssRules);
    return result.filter((name) => ['theme', 'base', 'components', 'utilities'].includes(name));
  });
  assert.deepEqual(layers, ['theme', 'base', 'components', 'utilities']);
  const before = await page
    .locator('.button--primary')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        height: parseFloat(style.height),
      };
    });
  assert.notEqual(before.background, 'rgba(0, 0, 0, 0)');
  assert.notEqual(before.background, before.color);
  assert.ok(before.height >= 32);
  assert.equal(
    await page
      .locator('.input-group')
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(element).getPropertyValue('--field-shadow').trim() ===
          getComputedStyle(document.documentElement).getPropertyValue('--field-shadow').trim(),
      ),
    true,
    'Native field shadows keep the upstream default without a host override',
  );
  const email = `fixture-${Date.now()}@example.test`;
  const response = await page.request.post(url + '/api/auth/sign-up/email', {
    headers: { origin: url },
    data: { name: 'Fixture User', email, password: 'Fixture-password-2026!' },
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
        itemPadding: parseFloat(
          getComputedStyle(element.querySelector('[role="menuitem"]')).paddingLeft,
        ),
      }));
      assert.ok(menu.padding > 0, JSON.stringify(menu));
      assert.ok(menu.itemPadding > 0, JSON.stringify(menu));
      await page.screenshot({
        animations: 'disabled',
        path: path.join(artifacts, `menu-${dark ? 'dark' : 'light'}-${width}.png`),
      });
      await page.keyboard.press('Escape');
      await page.getByRole('menu').waitFor({ state: 'hidden' });
    }
  }
  await page.getByRole('button', { name: 'Load fixture plugin' }).click();
  await page.getByText('Lazy plugin ready').waitFor();
  assert.equal(
    await page.locator('.fixture-plugin').evaluate((e) => getComputedStyle(e).padding),
    '16px',
  );
  await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
  assert.ok(
    (await page.getByRole('menu').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop))) > 0,
  );
  await page.keyboard.press('Escape');
  await page.getByRole('menu').waitFor({ state: 'hidden' });
  if (developmentTarget) {
    const stylesheet = path.join(developmentTarget, 'fixture-plugin/styles.css');
    const original = await readFile(stylesheet, 'utf8');
    try {
      await writeFile(stylesheet, '@layer components { .fixture-plugin { padding: 2rem; } }');
      await page.waitForFunction(() => {
        const element = document.querySelector('.fixture-plugin');
        return element && getComputedStyle(element).padding === '32px';
      });
      await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
      assert.ok(
        (await page.getByRole('menu').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop))) >
          0,
      );
      await page.keyboard.press('Escape');
      await page.getByRole('menu').waitFor({ state: 'hidden' });
    } finally {
      await writeFile(stylesheet, original);
    }
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.fixture-plugin')).padding === '16px',
    );
  }
  await page.getByRole('link', { name: 'Security settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Security', exact: true, level: 1 }).waitFor();
  await page.locator('input[type="password"]').first().waitFor();
  const input = await page
    .locator('input[type="password"]')
    .first()
    .evaluate((element) => {
      const container = element.closest('[data-slot="input-group"]') || element;
      const rect = container.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
  assert.ok(input.width > 100 && input.height >= 28, JSON.stringify(input));
  await page.screenshot({
    animations: 'disabled',
    path: path.join(artifacts, 'account-settings.png'),
    fullPage: true,
  });
  for (const dark of [false, true]) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      const twoFactor = page.locator('[data-two-factor-settings]');
      await twoFactor.getByRole('button', { name: /enable/i }).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      await dialog.locator('input[type="password"]').waitFor();
      const geometry = await dialog.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        padding: parseFloat(
          getComputedStyle(element.querySelector('[data-slot="modal-body"]') || element)
            .paddingLeft,
        ),
        focusInside: element.contains(document.activeElement),
      }));
      assert.ok(geometry.width > 250 && geometry.width <= width, JSON.stringify(geometry));
      assert.equal(geometry.focusInside, true);
      await page.screenshot({
        animations: 'disabled',
        path: path.join(artifacts, `two-factor-${dark ? 'dark' : 'light'}-${width}.png`),
      });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
  }
  await page.reload();
  await page.getByRole('heading', { name: 'Security', exact: true, level: 1 }).waitFor();
  await page.goto(url + '/settings/shell');
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page
    .getByRole('radio', { name: 'Dark', exact: true })
    .and(page.locator('[aria-checked="true"]'))
    .waitFor();
  await page.reload();
  await page
    .getByRole('radio', { name: 'Dark', exact: true })
    .and(page.locator('[aria-checked="true"]'))
    .waitFor();
  assert.equal(
    await page.getByRole('radio', { name: 'Dark', exact: true }).getAttribute('aria-checked'),
    'true',
  );
  assert.equal(
    await page.locator('html').evaluate((element) => element.classList.contains('dark')),
    true,
  );
}
