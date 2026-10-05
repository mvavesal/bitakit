import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:3103';
const env = parseEnv(await readFile(new URL('.env.local', import.meta.url), 'utf8'));
const browser = await chromium.launch();
try {
  for (const identity of ['alice', 'bob']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(error.message));
    await page.goto(`${origin}/auth/sign-in`);
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill(`${identity}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill(env.TODO_PREVIEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByRole('heading', { name: 'Todos', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
    await page.getByRole('menuitem', { name: /Design Studio/ }).click();
    await page.goto(`${origin}/settings/account`);
    await expect(page.getByRole('heading', { name: 'User profile', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Security', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Change password', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active sessions', exact: true })).toBeVisible();
    await expect(page.getByText('Current session', { exact: true })).toBeVisible();
    // The seed session has no UA in native storage. Rendering it must not crash or omit it.
    const rawSessions = await (
      await context.request.get(`${origin}/api/auth/list-sessions`)
    ).json();
    assert.ok(rawSessions.some((session) => !session.userAgent));
    await expect(page.getByText('Unknown Browser', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Organization profile', exact: true }).click();
    const membersPage = page.getByRole('link', { name: 'Members and invitations', exact: true });
    if (identity === 'alice') {
      await membersPage.click();
      await expect(
        page.getByRole('cell', { name: /Alice \(test\).*alice@example.test/ }),
      ).toBeVisible();
      await expect(
        page.getByRole('cell', { name: /Bob \(test\).*bob@example.test/ }),
      ).toBeVisible();
      for (const width of [390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(async () => {
          const geometry = await page.evaluate(() => {
            return {
              headings: document.querySelectorAll('main h1').length,
              nestedHeadings: document.querySelectorAll('main h2').length,
              overflow: document.documentElement.scrollWidth > window.innerWidth,
            };
          });
          assert.equal(geometry.headings, 1);
          assert.equal(geometry.nestedHeadings, 0);
          assert.equal(geometry.overflow, false);
        }).toPass({ timeout: 5000 });
      }
      await page.screenshot({ path: '/tmp/bitakit-members-repair.png', fullPage: true });
      await page.getByRole('button', { name: 'Invite member', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Invite member', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('tab', { name: /^Pending invitations/ }).click();
      await expect(page.getByText('No pending invitations.', { exact: true })).toBeVisible();
    } else {
      await expect(
        page.getByRole('heading', { name: 'Organization profile', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Delete organization', exact: true }),
      ).toHaveCount(0);
      await page.goto(`${origin}/settings/organization/members`);
      await expect(
        page.getByText('You do not have permission to manage this organization.'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Invite member', exact: true })).toHaveCount(0);
    }
    await page.getByRole('link', { name: 'My invitations', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My invitations', exact: true })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Verify your email address to see invitations.' }),
    ).toBeVisible();
    assert.deepEqual(crashes, []);
    if (identity === 'alice')
      await page.screenshot({ path: '/tmp/bitakit-settings-repair.png', fullPage: true });
    await context.close();
    console.log(
      `${identity}: account/session cards, members, pending and incoming invitations passed; role guards preserved.`,
    );
  }
} finally {
  await browser.close();
}
