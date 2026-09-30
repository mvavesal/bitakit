import { test, expect } from '@playwright/test';

const key = 'saas-foundation.theme';

test('Appearance displays pending, retains the confirmed theme on failure, and retries', async ({
  page,
}) => {
  await page.goto('/settings/appearance');
  const dark = page.getByRole('radio', { name: 'Dark', exact: true });
  const system = page.getByRole('radio', { name: 'System', exact: true });
  await expect(dark).toBeEnabled();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await gate;
    await route.abort('failed');
  };
  await page.route('**/settings/appearance', handler);
  await dark.click();
  await expect(dark).toBeDisabled();
  await expect(system).toBeChecked();
  await expect(page.getByRole('status')).toContainText('Saving theme');
  release();
  await expect(dark).toBeEnabled();
  await expect(system).toBeChecked();
  await expect(page.getByRole('main').getByRole('alert').first()).toBeVisible();
  await page.unroute('**/settings/appearance', handler);
  await dark.click();
  await expect(dark).toBeChecked();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('mobile Settings drawer inside the intercepted dialog preserves the Studio and keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app-preview');
  await page.getByLabel('Course title').fill('Keep this mobile draft');
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings
    .getByRole('main')
    .getByRole('link', { name: /^Appearance/ })
    .click();
  await settings.getByRole('button', { name: 'Toggle settings navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'Settings navigation', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('textbox', { name: 'Search settings' }).fill('Language');
  await drawer.getByRole('link', { name: 'Language', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(settings.getByRole('heading', { name: 'Language', exact: true })).toBeVisible();
  await settings.getByRole('radio', { name: 'Deutsch' }).click();
  const translated = page.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await translated.getByRole('button', { name: 'Einstellungsnavigation umschalten' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Einstellungsnavigation', exact: true })
      .getByRole('textbox', { name: 'Einstellungen suchen' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Einstellungsnavigation', exact: true }),
  ).toHaveCount(0);
  await expect(
    translated.getByRole('button', { name: 'Einstellungsnavigation umschalten' }),
  ).toBeFocused();
  await translated.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(page.getByLabel('Course title')).toHaveValue('Keep this mobile draft');
});

test('system theme follows OS changes; explicit preferences, header and reset stay synchronized', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings/appearance');
  const system = page.getByRole('radio', { name: 'System', exact: true });
  await expect(system).toBeEnabled();
  await expect(system).toBeChecked();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass('dark');
  await expect(page.getByRole('status')).toContainText('currently dark');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).not.toHaveClass('dark');
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Restore default' }).click();
  await expect(system).toBeChecked();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('system');
  await expect(page.getByRole('button', { name: 'Restore default' })).toBeDisabled();
  await page.reload();
  await expect(system).toBeChecked();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass('dark');
  // Standard radio keyboard behavior is retained.
  await expect(system).toBeEnabled();
  await system.focus();
  await page.keyboard.down('ArrowUp');
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.keyboard.up('ArrowUp');
  expect(errors).toEqual([]);
});

test('saved theme is applied before body rendering and updates across tabs', async ({
  page,
  context,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dark');
    const observer = new MutationObserver(() => {
      if (document.documentElement?.dataset.themePreference) {
        (window as Window & { themeBeforeBody?: boolean }).themeBeforeBody =
          document.documentElement.classList.contains('dark') && !document.body;
        observer.disconnect();
      }
    });
    observer.observe(document, { subtree: true, attributes: true, childList: true });
  }, key);
  await page.goto('/settings/appearance');
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  expect(
    await page.evaluate(() => (window as Window & { themeBeforeBody?: boolean }).themeBeforeBody),
  ).toBe(true);
  const other = await context.newPage();
  await other.goto('/settings/appearance');
  await expect(other.getByRole('button', { name: 'Toggle light and dark theme' })).toBeEnabled();
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(other.locator('html')).not.toHaveClass('dark');
  await other.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await other.close();
});

test('blocked browser storage keeps a usable in-tab theme preference', async ({ page }) => {
  await page.goto('/settings/appearance');
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Blocked');
    };
  });
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Settings', exact: true })
    .getByRole('main')
    .getByRole('link', { name: /^Appearance/ })
    .click();
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.locator('html')).not.toHaveClass('dark');
});

test('search uses URL state, registered sections route correctly, and mobile navigation works', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app-preview');
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByLabel('Search settings').fill('dark');
  await expect(page).toHaveURL(/\?q=dark$/);
  await page.reload();
  await expect(page.getByLabel('Search settings')).toHaveValue('dark');
  await page
    .getByRole('main')
    .getByRole('link', { name: /^Appearance/ })
    .click();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await page.goBack();
  await expect(page.getByLabel('Search settings')).toHaveValue('dark');
  await page.getByLabel('Search settings').fill('billing');
  await expect(page.getByText('No matching settings')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle settings navigation' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Appearance', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
  const missing = await page.goto('/settings/not-registered');
  // Runtime plugin pages resolve after hydration; the initial streamed response is 200.
  expect(missing?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Settings section unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'All settings', exact: true })).toHaveAttribute(
    'href',
    '/settings',
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

for (const mobile of [false, true]) {
  test(`settings preserve unsaved course and view on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/app-preview?view=working#studio-content');
    await page.getByLabel('Course title').fill('Unfinished course — keep this');
    await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
    if (mobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('main')
      .getByRole('link', { name: /^Appearance/ })
      .click();
    await dialog.getByRole('radio', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveClass('dark');
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Close settings' }).click();
    await expect(page).toHaveURL(/\/app-preview\?view=working#studio-content$/);
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Unfinished course — keep this' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to editing' }).first().click();
    await expect(page.getByLabel('Course title')).toHaveValue('Unfinished course — keep this');
    await expect(page.getByRole('button', { name: 'Save draft' }).first()).toBeEnabled();
    // A second visit and Escape must restore focus without a navigation loop.
    if (mobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(dialog).toBeVisible();
    // Let the closing mobile navigation sheet release its dismissable layer.
    await expect(
      page.getByRole('dialog', { name: 'Sidebar', exact: true, includeHidden: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel('Course title')).toHaveValue('Unfinished course — keep this');
    if (mobile) await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeFocused();
    else await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
}
