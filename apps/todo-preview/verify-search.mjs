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
  const category = dialog.getByRole('button', { name: 'Filter by category' });
  const trigger = page.locator('.quick-search-trigger');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(trigger.locator('svg[aria-hidden=true]')).toHaveCount(1);
  await expect(trigger.locator('kbd')).toHaveText(/(?:⌘|Ctrl).*K/);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(category).toHaveText('All categories');
  await expect(dialog.locator('.quick-search-controls button')).toHaveCount(1);
  await expect(dialog.locator('[aria-pressed]')).toHaveCount(0);
  await input.fill(title);
  const link = dialog.getByRole('link', { name: title, exact: true });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  assert.match(href, /^\/todos#task-/);
  await category.click();
  await page.getByRole('menuitemradio', { name: 'Tasks', exact: true }).click();
  await expect(category).toHaveText('Tasks');
  await expect(link).toBeVisible();
  await page.keyboard.press('Escape');
  await open();
  await expect(category).toHaveText('All categories');
  await page.keyboard.press('Escape');
  await page.goto(url + '/settings/quick-search');
  const setting = page.getByRole('switch', { name: 'Todos', exact: true });
  await expect(setting).toBeChecked();
  await expect(setting.locator('..').locator('svg[aria-hidden=true]')).toHaveCount(1);
  await setting.click();
  await expect(setting).not.toBeChecked();
  await open();
  await input.fill(title);
  await expect(link).toHaveCount(0);
  await category.click();
  await expect(page.getByRole('menuitemradio', { name: 'Tasks', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('.quick-search-category-menu').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
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
  for (const [width, height, colorScheme, suffix] of [
    [1280, 900, 'light', ''],
    [1280, 900, 'dark', '-dark'],
    [375, 720, 'light', '-mobile'],
    [375, 720, 'dark', '-mobile-dark'],
  ]) {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme });
    if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
    else await expect(page.locator('html')).not.toHaveClass(/dark/);
    await trigger.hover();
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    const field = await trigger.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const input = getComputedStyle(document.querySelector('input[placeholder="New task"]'));
      const placeholder = getComputedStyle(
        document.querySelector('input[placeholder="New task"]'),
        '::placeholder',
      );
      const label = getComputedStyle(element.querySelector('.quick-search-trigger-label'));
      const key = getComputedStyle(element.querySelector('kbd'));
      return {
        tag: element.tagName,
        height: bounds.height,
        inside: bounds.left >= 0 && bounds.right <= innerWidth,
        backgroundImage: style.backgroundImage,
        surface: style.backgroundColor === input.backgroundColor,
        radius: style.borderRadius === input.borderRadius,
        shadow:
          style.getPropertyValue('--control-depth-shadow') ===
          input.getPropertyValue('--control-depth-shadow'),
        placeholder: label.color === placeholder.color && label.fontWeight === '400',
        keycap: key.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(key.paddingLeft) > 0,
      };
    });
    assert.equal(field.tag, 'BUTTON');
    assert.equal(field.height, 36);
    assert.equal(field.backgroundImage, 'none');
    assert.ok(
      field.inside &&
        field.surface &&
        field.radius &&
        field.shadow &&
        field.placeholder &&
        field.keycap,
      `AppBar trigger uses the central field surface and fits the viewport: ${JSON.stringify(field)}`,
    );
    await page.screenshot({
      path: new URL(`trigger${suffix}.png`, artifacts).pathname,
      animations: 'disabled',
    });
    await trigger.click();
    await input.fill(title);
    await expect(link).toBeVisible();
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    const compact = await dialog.evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const controls = element.querySelector('.quick-search-controls').getBoundingClientRect();
      const input = element.querySelector('.quick-search-input').getBoundingClientRect();
      return {
        inside: panel.bottom <= innerHeight && panel.left >= 0 && panel.right <= innerWidth,
        compact: controls.height <= input.height,
      };
    });
    assert.ok(compact.inside && compact.compact, 'Compact single row and dialog fit the viewport');
    await page.screenshot({
      path: new URL(`search${suffix}.png`, artifacts).pathname,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
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
  await expect(category).toHaveText('All categories');
  await input.fill(title);
  await expect(link).toBeVisible();
  console.log(
    'Todo search: input-style trigger with icon, compact category filter in light/dark desktop/mobile, Settings source choices/icons, task links, history, organization isolation and persistence passed.',
  );
} finally {
  await browser.close();
}
