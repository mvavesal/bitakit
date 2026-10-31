import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

/** Real installed fixture packages exercise discovery and the packed runtime together. */
export async function configurePluginGroupingFixture(target) {
  const put = async (file, value) => {
    const destination = path.join(target, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(
      destination,
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    );
  };
  const manifest = JSON.parse(await readFile(path.join(target, 'package.json'), 'utf8'));
  manifest.bitakit = { bundle: '@fixture/HOST' };
  for (const [id, memberOf] of [
    ['multi', ['@fixture/HOST', '@fixture/OTHER']],
    ['general', ['*']],
    ['unresolved', ['@fixture/missing']],
    ['unspecified', undefined],
  ]) {
    const folder = `fixtures/${id}`;
    const name = `@fixture/${id}`;
    manifest.dependencies[name] = `file:./${folder}`;
    await put(`${folder}/package.json`, {
      name,
      version: '1.0.0',
      type: 'module',
      exports: {
        './package.json': './package.json',
        './plugin': { types: './plugin.d.ts', default: './plugin.js' },
      },
      bitakit: { plugin: './plugin', id, title: `Fixture ${id}`, memberOf },
    });
    await put(
      `${folder}/plugin.js`,
      `export default () => ({ id: '${id}', metadata: { name: 'Legacy ${id}' } });\n`,
    );
    await put(`${folder}/plugin.d.ts`, `export default function plugin(): { id: '${id}' };\n`);
  }
  await put('package.json', manifest);
  await put(
    'bitakit.config.ts',
    `import { defineBitaKit } from '@bitakit/discovery';
export default defineBitaKit({ bundles: [{ id: '@fixture/other', label: 'Other application' }], plugins: { include: { included: './fixtures/included/src' } } });\n`,
  );
  await put('fixtures/included/package.json', {
    name: '@fixture/included',
    bitakit: { title: 'Fixture included' },
  });
  await put('fixtures/included/src/plugin.config.ts', 'export default {};\n');
  await put(
    'fixtures/included/src/AGENTS.md',
    '# Included fixture\n\nEmpty included plugin for provenance verification.\n',
  );
  await put('fixtures/included/src/CLAUDE.md', '@AGENTS.md\n');
}

export async function verifyPluginGrouping(page, url, artifacts) {
  const route = url + '/settings/plugins?pluginView=grouped';
  await page.goto(route);
  const groups = [
    'This application',
    'Other application',
    '@fixture/missing (unresolved)',
    'General purpose',
    'Not assigned',
  ];
  for (const name of groups)
    await expect(page.getByRole('list', { name, exact: true })).toBeVisible();
  const multi = page.locator('a[href*="plugin=multi"]');
  await expect(multi).toHaveCount(2);
  await expect(multi.first()).toContainText('Fixture multi');
  await expect(page.getByRole('list', { name: 'Not assigned', exact: true })).toContainText(
    'Fixture included',
  );
  const distinct = new Set(
    await page
      .locator('[role=list] a[href*="plugin="]')
      .evaluateAll((links) => links.map((link) => new URL(link.href).searchParams.get('plugin'))),
  );
  await expect(page.locator('p[role=status]')).toHaveText(`${distinct.size} plugins`);
  const toggles = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: /Fixture multi/ }) })
    .getByRole('switch');
  await toggles.first().click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(toggles.first()).not.toBeChecked();
  await expect(toggles.last()).not.toBeChecked();
  await toggles.first().click();
  await expect(toggles.last()).toBeChecked();
  await multi.first().click();
  await expect(page).toHaveURL(/pluginView=grouped.*plugin=multi|plugin=multi.*pluginView=grouped/);
  await page.goBack();
  await expect(multi).toHaveCount(2);
  await page
    .getByRole('textbox', { name: 'Search plugins', exact: true })
    .fill('Fixture unspecified');
  await expect(page.locator('p[role=status]')).toHaveText('1 plugin');
  await expect(page.getByRole('list', { name: 'Not assigned', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/pluginSearch=Fixture/);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search plugins', exact: true })).toHaveValue(
    'Fixture unspecified',
  );
  await page.goto(route + '&pluginBundle=bundle%3A%40FIXTURE%2FOTHER');
  await expect(page.locator('p[role=status]')).toHaveText('1 plugin');
  await expect(page.getByRole('list', { name: 'Other application', exact: true })).toBeVisible();
  await page.goto(route);
  await page.getByRole('button', { name: 'Plugin view', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('menuitemradio', { name: 'Grouped by bundle', exact: true }),
  ).toBeChecked();
  await page.keyboard.press('Escape');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'Plugin grouping must not overflow the viewport',
      );
      await page.screenshot({
        path: path.join(artifacts, `plugins-${width}-${dark ? 'dark' : 'light'}.png`),
        animations: 'disabled',
      });
    }
  }
}

/** Development discovery keeps navigation and grouped metadata live without a server restart. */
export async function verifyPluginGroupingUpdates(page, url, target) {
  const folder = path.join(target, 'src/plugins/live-check');
  const manifest = path.join(folder, 'plugin.config.ts');
  const action = path.join(folder, 'actions/open.ts');
  const source = (title) => `import { defineAction } from '@bitakit/core';
export default defineAction({ title: '${title}', href: '/todos', slots: ['shell.navigation'] });\n`;
  await page.goto(url);
  try {
    await mkdir(path.dirname(action), { recursive: true });
    await writeFile(manifest, `export default { metadata: { name: 'Live metadata' } };\n`);
    await writeFile(action, source('Live first'));
    await expect(page.getByRole('link', { name: 'Live first', exact: true })).toBeVisible({
      timeout: 30000,
    });
    await writeFile(action, source('Live changed'));
    await expect(page.getByRole('link', { name: 'Live changed', exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole('link', { name: 'Live first', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Live changed', exact: true }).click();
    await expect(page).toHaveURL(/\/todos$/);
    await page.goto(url + '/settings/plugins?pluginView=grouped');
    const local = page.getByRole('list', { name: 'This application', exact: true });
    await expect(local).toContainText('Live metadata');
    await writeFile(manifest, `export default { metadata: { name: 'Live updated' } };\n`);
    await expect(local).toContainText('Live updated', { timeout: 30000 });
    await expect(page.locator('a[href*="plugin=live-check"]')).toHaveCount(1);
    await rm(folder, { recursive: true });
    await expect(page.locator('a[href*="plugin=live-check"]')).toHaveCount(0, { timeout: 30000 });
    await page.goto(url);
    await expect(page.getByRole('link', { name: 'Live changed', exact: true })).toHaveCount(0);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
