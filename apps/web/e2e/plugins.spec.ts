import { test, expect } from '@playwright/test';

// The dashboard requires an authenticated session; no auth bypass or test-only route.
const session = process.env.PLUGIN_TEST_STORAGE_STATE;
test.use({ storageState: session });
test.skip(!session, 'Set PLUGIN_TEST_STORAGE_STATE to an authenticated test session.');

test('discovered invite action renders in button and menu; errors retain input and success closes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().addCookies([
    {
      name: 'saas-foundation.locale',
      value: 'en',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await page.goto('/dashboard');
  const title = page.getByRole('button', {
    name: /Benutzer einladen|Invite user/,
    exact: true,
  });
  await expect(title).toBeVisible();
  await title.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Demo invitation created', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Email address')).toBeVisible();
  await dialog.getByRole('textbox').fill('error@example.com');
  await dialog
    .getByRole('button', {
      name: /Benutzer einladen|Invite user/,
    })
    .click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'The demo invitation failed. Please try again.',
  );
  await expect(dialog.getByRole('textbox')).toHaveValue('error@example.com');
  await dialog.getByRole('textbox').fill('test@example.com');
  await dialog
    .getByRole('button', {
      name: /Benutzer einladen|Invite user/,
    })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Demo invitation created', { exact: true })).toBeVisible();
  await expect(title).toBeFocused();
  await page.getByRole('button', { name: /Benutzeraktionen|User actions/ }).click();
  await page.getByRole('menuitem', { name: /Benutzer einladen|Invite user/ }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: /Benutzeraktionen|User actions/ })).toBeFocused();
  expect(errors).toEqual([]);
});

test('German plugin form fits a narrow screen', async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'saas-foundation.locale',
      value: 'de',
      url: 'http://127.0.0.1:3101',
    },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Benutzer einladen', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const locale of ['de', 'en']) {
  test(`simple demo plugin appears automatically in button and menu (${locale})`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'saas-foundation.locale', value: locale, url: 'http://127.0.0.1:3101' },
    ]);
    const title = locale === 'de' ? 'Hallo sagen' : 'Say hello';
    const message = locale === 'de' ? 'Hallo aus dem Demo-Plugin!' : 'Hello from the demo plugin!';
    await page.goto('/dashboard');
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await page
      .getByRole('button', {
        name: locale === 'de' ? 'Demo-Aktionen' : 'Demo actions',
        exact: true,
      })
      .click();
    await expect(page.getByRole('menuitem', { name: title, exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: title, exact: true }).click();
    await expect(page.getByRole('menu')).not.toBeVisible();
  });
}

test('plugin settings supports direct loads and controls its action without persistence', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'saas-foundation.locale', value: 'en', url: 'http://127.0.0.1:3101' },
  ]);
  await page.goto('/settings/plugins');
  await expect(page.getByRole('heading', { name: 'Plugins', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demo', exact: true }).last()).toBeVisible();
  await page.goto('/settings/demo');
  const toggle = page.getByRole('checkbox', { name: 'Enable greeting' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(toggle).toBeChecked();
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Demo settings', exact: true }).click();
  await toggle.uncheck();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Say hello', exact: true })).toBeDisabled();
});
