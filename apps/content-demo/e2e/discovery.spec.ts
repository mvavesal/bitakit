import { test, expect } from '@playwright/test';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

test('new independent plugin action and page appear, update and disappear without manual reload', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: { user: { id: 'discovery-test', name: 'Discovery', email: 'discovery@example.test', emailVerified: true }, session: { id: 'discovery-session', userId: 'discovery-test', expiresAt: new Date(Date.now() + 3600000).toISOString() } } }));
  const root = path.resolve('src/plugins/live-check');
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'plugin.config.ts'), "export default { id: 'live-check' };");
  const action = path.join(root, 'actions.live-check.ts');
  const view = path.join(root, 'pages.live-check.tsx');
  const definition = (title: string) =>
    `import { defineURLAction } from '@bitakit/core'; export default defineURLAction({title:${JSON.stringify(title)},href:'/live-check',groups:['navigation']});`;
  try {
    await page.goto('/');
    await writeFile(
      view,
      `import { definePage } from '@bitakit/core'; export default definePage({path:'/live-check',component:()=> <h1>Live-Seite</h1>});`,
    );
    await writeFile(action, definition('Live-Prüfung'));
    await expect(async () => {
      await expect(page.getByRole('link', { name: 'Live-Prüfung', exact: true })).toBeVisible();
    }).toPass({ timeout: 20000 });
    await page.getByRole('link', { name: 'Live-Prüfung', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Live-Seite' })).toBeVisible();
    await writeFile(action, definition('Live geändert'));
    await expect(async () => {
      await expect(page.getByRole('link', { name: 'Live geändert', exact: true })).toBeVisible();
    }).toPass({ timeout: 20000 });
    await rm(action);
    await rm(view);
    await expect(async () => {
      await expect(page.getByRole('link', { name: 'Live geändert', exact: true })).toHaveCount(0);
      await expect(page.getByRole('status')).toHaveText('Diese Plugin-Seite ist nicht verfügbar.');
    }).toPass({ timeout: 20000 });
  } finally {
    await rm(action, { force: true });
    await rm(view, { force: true });
    await rm(root, { recursive: true, force: true });
  }
});

