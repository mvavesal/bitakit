import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

/** Copy the shipped extension example unchanged into a generated host. */
export async function configureSearchFixture(target) {
  const catalog = path.join(target, 'src/plugins/catalog');
  await mkdir(path.dirname(catalog), { recursive: true });
  await cp(new URL('../../packages/quick-search/examples/catalog/', import.meta.url), catalog, {
    recursive: true,
  });
  // This second source exercises independent failure/loading without a backend or domain model.
  const delayed = path.join(target, 'src/plugins/search-checks');
  await mkdir(delayed, { recursive: true });
  await writeFile(
    path.join(delayed, 'setup.ts'),
    `import type { Setup } from '@bitakit/core';
import type { SearchSource } from '@bitakit/quick-search/sources';
const source: SearchSource = {
  title: 'Slow fixture', description: 'A controlled asynchronous source.',
  category: { id: 'fixture', title: 'Fixture' }, defaultEnabled: true,
  async search({ query, signal }) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (query === 'failure') throw new Error('Private fixture detail');
    if (signal.aborted || !query) return [];
    return [{ id: query, title: 'Delayed ' + query, href: '/catalog?delayed=' + encodeURIComponent(query) }];
  },
  resolve() { return null; },
};
const setup: Setup = ({ scope }) => {
  const handle = scope.slots.attach({ slot: 'quick-search.sources', id: 'slow', data: source }, { availability: 'wait' });
  return () => handle.dispose();
};
export default setup;
`,
  );
}

export async function verifySearch(page, url, artifacts) {
  await page.goto(url);
  const open = async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();
  };
  await open();
  const input = page.getByRole('dialog').getByRole('combobox', { name: 'Quick search' });
  await input.fill('composition');
  await expect(page.getByRole('link', { name: /Composition basics/ })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Slow fixture: Searching' }),
  ).toBeVisible();
  await input.fill('first');
  await input.fill('second');
  await expect(page.getByRole('link', { name: 'Delayed second' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Delayed first' })).toHaveCount(0);
  await input.fill('failure');
  await expect(
    page.getByRole('status').filter({ hasText: 'Could not load results' }),
  ).toBeVisible();
  await expect(page.getByText('Private fixture detail')).toHaveCount(0);
  await input.fill('composition');
  await page.getByRole('link', { name: /Composition basics/ }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await open();
  await expect(page.getByText('Recent searches', { exact: true })).toBeVisible();
  await expect(page.getByText('Recently opened', { exact: true })).toBeVisible();
  const sourceSwitch = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Learning catalog', exact: true });
  await expect(sourceSwitch).toHaveAttribute('aria-pressed', 'true');
  await sourceSwitch.click();
  await expect(sourceSwitch).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await page.goto(url + '/settings/quick-search');
  await expect(page.getByRole('heading', { name: 'Quick search', exact: true })).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Learning catalog', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('switch', { name: 'Learning catalog', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Learning catalog', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clear history', exact: true })).toBeDisabled();
  await page.getByRole('switch', { name: 'Remember search history', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Remember search history', exact: true }),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByRole('switch', { name: 'Remember search history', exact: true }),
  ).not.toBeChecked();
  await open();
  await expect(page.getByText('Recent searches', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filter by category' }).click();
  await page.getByRole('menuitemradio', { name: 'Learning', exact: true }).click();
  await expect(page.getByRole('link', { name: /Composition basics/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Delayed/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open();
  await expect(page.getByRole('button', { name: 'Filter by category' })).toHaveText(
    'Category: All categories',
  );
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 720 : 900 });
    for (const dark of [false, true]) {
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark);
      await expect(input).toBeVisible();
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
      const dimensions = await page.getByRole('dialog').evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: innerWidth,
          height: innerHeight,
          font: getComputedStyle(element).fontFamily,
        };
      });
      assert.ok(dimensions.left >= 0 && dimensions.right <= dimensions.width + 1);
      assert.ok(dimensions.top >= 0 && dimensions.bottom <= dimensions.height + 1);
      assert.ok(dimensions.font);
      await page.screenshot({
        animations: 'disabled',
        path: path.join(artifacts, `quick-search-${width}-${dark ? 'dark' : 'light'}.png`),
      });
    }
  }
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Learning catalog', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: path.join(artifacts, 'quick-search-source-preferences.png'),
  });
  await page.keyboard.press('Escape');
}
