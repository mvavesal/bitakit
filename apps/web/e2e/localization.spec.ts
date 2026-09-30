import { test, expect } from '@playwright/test';
import en from '../locales/en.json';
import de from '../locales/de.json';

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, item]) =>
      typeof item === 'object' ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`],
    )
    .sort();
}

test('language catalogs have matching keys', () => {
  expect(keys(de)).toEqual(keys(en));
});

test('language changes persist, update server pages, and safely handle unknown locales', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/settings/language');
  await page.getByRole('radio', { name: 'Deutsch' }).click();
  await expect(page.getByRole('heading', { name: 'Sprache', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Deutsch' })).toBeChecked();
  await page.getByRole('link', { name: 'Darstellung', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Dunkel', exact: true })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
  await page.goto('/settings/language');
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Language', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await context.addCookies([
    { name: 'saas-foundation.locale', value: '../../invalid', url: 'http://127.0.0.1:3101' },
  ]);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
  expect(errors).toEqual([]);
});

test('switching language in settings preserves the mounted workspace and unsaved content', async ({
  page,
}) => {
  await page.goto('/app-preview');
  const title = page.getByLabel('Course title');
  await title.fill('Untranslated unsaved content');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Language', exact: true }).click();
  await page.getByRole('radio', { name: 'Deutsch' }).click();
  const dialog = page.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Sprache', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/settings-language-de.png' });
  await dialog.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(title).toHaveValue('Untranslated unsaved content');
  await expect(page.getByRole('link', { name: 'Einstellungen', exact: true })).toBeVisible();
});
