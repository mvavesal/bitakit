import { test, expect } from '@playwright/test';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

test('new independent plugin action and page appear, update and disappear without manual reload', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'discovery-test',
          name: 'Discovery',
          email: 'discovery@example.test',
          emailVerified: true,
        },
        session: {
          id: 'discovery-session',
          userId: 'discovery-test',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    }),
  );
  // The folder name is the plugin ID; the action ID is live-check.open and the page serves /live-check.
  const root = path.resolve('src/plugins/live-check');
  await mkdir(path.join(root, 'actions'), { recursive: true });
  await mkdir(path.join(root, 'ui/pages'), { recursive: true });
  const action = path.join(root, 'actions/open.ts');
  const view = path.join(root, 'ui/pages/index.tsx');
  const definition = (title: string) =>
    `import { defineAction } from '@bitakit/core'; export default defineAction({title:${JSON.stringify(title)},href:'/live-check',groups:['navigation']});`;
  try {
    await page.goto('/');
    await writeFile(
      view,
      `export default function LiveCheckPage() { return <h1>Live-Seite</h1>; }`,
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
    await rm(root, { recursive: true, force: true });
  }
});
