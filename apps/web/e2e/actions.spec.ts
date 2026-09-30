import { test, expect } from '@playwright/test';

test('both bindings follow central settings, current handler, busy state and errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/actions-demo');
  const quick = page.getByRole('group', { name: 'Quick actions' });
  const draft = page.getByRole('group', { name: 'Draft actions' });
  await expect(quick.getByRole('button', { name: 'Save draft' })).toBeVisible();
  await page.getByLabel('Save action label').fill('Publish draft');
  const first = quick.getByRole('button', { name: 'Publish draft' });
  const second = draft.getByRole('button', { name: 'Publish draft' });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const originalIcon = await first.locator('svg').innerHTML();
  await page.getByRole('button', { name: 'Switch icon' }).click();
  await expect(first.locator('svg')).toHaveClass(/reicon/);
  await expect.poll(() => first.locator('svg').innerHTML()).not.toBe(originalIcon);
  expect(await second.locator('svg').innerHTML()).toBe(await first.locator('svg').innerHTML());
  await page.getByRole('button', { name: 'Disable save' }).click();
  await expect(first).toBeDisabled();
  await expect(second).toBeDisabled();
  await page.getByRole('button', { name: 'Enable save' }).click();
  await page.getByRole('button', { name: 'Hide save' }).click();
  await expect(first).toHaveCount(0);
  await expect(second).toHaveCount(0);
  await page.getByRole('button', { name: 'Show save' }).click();
  await quick.getByRole('button', { name: 'Preview mode' }).click();
  await expect(draft.getByRole('button', { name: 'Preview mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await draft.getByRole('button', { name: 'Preview mode' }).click();
  await expect(quick.getByRole('button', { name: 'Preview mode' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Use alternate handler' }).click();
  await first.click();
  await expect(quick.getByRole('button', { name: 'Working…' })).toBeDisabled();
  await expect(draft.getByRole('button', { name: 'Working…' })).toBeDisabled();
  await expect(page.locator('p[role="status"]')).toContainText('Alternate handler completed.');
  await expect(page.getByTestId('completed-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Use failing handler' }).click();
  await second.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Action failed' })).toContainText(
    'Example failure.',
  );
  await expect(first).toBeEnabled();
  await expect(second).toBeEnabled();
  await page.getByRole('button', { name: 'Restore save handler' }).click();
  await second.click();
  await expect(page.locator('p[role="status"]')).toContainText('Draft saved locally');
  await expect(page.getByTestId('completed-count')).toHaveText('2');
  expect(errors).toEqual([]);
});

test('public demo is responsive while dashboard remains protected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/actions-demo');
  await expect(page.getByRole('heading', { name: 'One action. Every control.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
