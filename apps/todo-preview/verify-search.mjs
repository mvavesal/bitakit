import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium, expect } from '@playwright/test';

const url = 'http://127.0.0.1:3103';
const env = parseEnv(await readFile(new URL('.env.local', import.meta.url), 'utf8'));
const artifacts = new URL('../../.private/quick-search/todo-verification/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const title = `Search preview ${Date.now()}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url + '/auth/sign-in');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('alice@example.test');
  await page.getByLabel('Password', { exact: true }).fill(env.TODO_PREVIEW_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Todos', exact: true })).toBeVisible();
  const organization = async (name) => {
    await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
    await page.getByRole('menuitem', { name: new RegExp(name) }).click();
    await expect(
      page.getByRole('button', { name: 'Switch organization', exact: true }),
    ).toContainText(name);
  };
  await organization('Design Studio');
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill(title);
  await page.getByRole('main').getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();
  const open = async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();
  };
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('combobox', { name: 'Quick search' });
  const source = dialog.getByRole('button', { name: 'Todos', exact: true });
  await open();
  await expect(source).toHaveAttribute('aria-pressed', 'true');
  await expect(source.locator('svg[aria-hidden=true]')).toHaveCount(1);
  await input.fill(title);
  const link = dialog.getByRole('link', { name: title, exact: true });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  assert.match(href, /^\/todos#task-/);
  await source.click();
  await expect(source).toHaveAttribute('aria-pressed', 'false');
  await expect(link).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto(url + '/settings/quick-search');
  const setting = page.getByRole('switch', { name: 'Todos', exact: true });
  await expect(setting).not.toBeChecked();
  await expect(setting.locator('..').locator('svg[aria-hidden=true]')).toHaveCount(1);
  await setting.click();
  await expect(setting).toBeChecked();
  await page.screenshot({
    path: new URL('settings.png', artifacts).pathname,
    animations: 'disabled',
  });
  await open();
  await input.fill(title);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(url + href);
  await open();
  await expect(dialog.getByText('Recently opened', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Recent searches', { exact: true })).toBeVisible();
  await input.fill(title);
  await expect(link).toBeVisible();
  await page.screenshot({
    path: new URL('search.png', artifacts).pathname,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await organization('Alice private team');
  await open();
  await input.fill(title);
  await expect(link).toHaveCount(0);
  await expect(dialog.getByText('No results found.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await organization('Design Studio');
  await open();
  await input.fill(title);
  await expect(link).toBeVisible();
  await page.reload();
  await open();
  await expect(source).toHaveAttribute('aria-pressed', 'true');
  console.log(
    'Todo source: actual tasks, icons, shared preferences, native task links, history, organization isolation and persistence passed.',
  );
} finally {
  await browser.close();
}
