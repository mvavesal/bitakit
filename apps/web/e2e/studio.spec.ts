import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('studio edits, shared actions, persistence, preview and JSON download', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/app-preview');
  await page.getByLabel('Course title', { exact: true }).fill('Welcome to our team');
  const saves = page.getByRole('button', { name: 'Save draft', exact: true });
  await expect(saves).toHaveCount(2);
  await expect(saves.first()).toBeEnabled();
  await expect(saves.last()).toBeEnabled();
  await saves.last().click();
  await expect(saves.first()).toBeDisabled();
  await expect(saves.last()).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Course title', { exact: true })).toHaveValue('Welcome to our team');
  await page.getByRole('button', { name: 'Preview', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Welcome to our team' })).toBeVisible();
  const back = page.getByRole('button', { name: 'Back to editing', exact: true });
  await expect(back).toHaveCount(2);
  await expect(back.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(back.last()).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('region', { name: 'Course preview' }).getByRole('heading'),
  ).toHaveCount(3);
  await back.first().click();
  await page.getByLabel('Course title', { exact: true }).fill('');
  await expect(saves.first()).toBeDisabled();
  await expect(saves.last()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
  await page.getByLabel('Course title', { exact: true }).fill('Latest unsaved title');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const download = await downloadEvent;
  const document = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(document.title).toBe('Latest unsaved title');
  expect(document.schemaVersion).toBe(1);
  expect(document.lessons).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('theme persists across routes and mobile navigation preserves auth boundary', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app-preview');
  await page.getByLabel('Course title', { exact: true }).fill('A'.repeat(120));
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass('dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await page.getByRole('link', { name: 'Account dashboard' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('failed local save keeps changes available for download', async ({ page }) => {
  await page.goto('/app-preview');
  await page.getByLabel('Course title', { exact: true }).fill('Keep this draft');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Draft needs attention' })).toContainText(
    'Download a copy',
  );
  await expect(page.getByRole('button', { name: 'Save draft', exact: true }).last()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeEnabled();
  await expect(page.getByLabel('Course title', { exact: true })).toHaveValue('Keep this draft');
});
