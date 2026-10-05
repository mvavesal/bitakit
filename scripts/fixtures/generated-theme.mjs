import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

// One host stylesheet; no selectors targeting individual plugin components.
export async function configureThemeFixture(target) {
  const css = `:root[data-app-theme='fixture'] {
  --background: rgb(245 241 225); --foreground: rgb(25 35 50);
  --card: rgb(255 252 240); --card-foreground: var(--foreground);
  --popover: rgb(250 246 225); --popover-foreground: var(--foreground);
  --primary: rgb(15 90 130); --primary-foreground: white;
  --input: rgb(40 85 100); --border: rgb(40 85 100); --ring: rgb(140 55 90);
  --muted: rgb(225 225 210); --muted-foreground: rgb(55 70 75);
  --accent: rgb(210 225 225); --accent-foreground: var(--foreground);
  --light--sidebar: rgb(220 232 228); --dark--sidebar: rgb(20 40 45);
  --radius: 0.3rem; --corner-shape: round; --border-width: 3px; --focus-ring-width: 5px;
  --font-sans: Georgia, serif; --text-sm: 1rem; --text-xs: 0.8rem;
  --theme-shadow-surface: 4px 6px 0 rgb(85 105 105);
  --theme-shadow-overlay: 6px 8px 0 rgb(85 105 105);
  --theme-shadow-control: 2px 3px 0 rgb(85 105 105);
  --theme-shadow-field: inset 0 0 0 1px rgb(80 130 145);
  --theme-control-gradient: none;
  --theme-control-hover-shadow: inset 0 0 0 3px rgb(140 55 90);
  --theme-control-pressed-shadow: inset 0 2px 0 rgb(40 60 70);
  --theme-control-pressed-scale: 0.99; --theme-control-pressed-offset: 0px;
  --theme-motion-duration: 40ms; --theme-motion-ease: linear;
}
:root[data-app-theme='fixture'].dark {
  --background: rgb(20 30 35); --foreground: rgb(240 235 210);
  --card: rgb(30 45 50); --popover: rgb(35 50 55);
  --primary: rgb(225 175 85); --primary-foreground: rgb(20 30 35);
  --muted-foreground: rgb(180 200 195);
}
`;
  await writeFile(path.join(target, 'src/app/developer-theme.css'), css);
  const root = path.join(target, 'src/app/globals.css');
  await writeFile(root, (await readFile(root, 'utf8')) + "\n@import './developer-theme.css';\n");
  const route = path.join(target, 'src/app/(app)/theme-checks');
  await mkdir(route, { recursive: true });
  await writeFile(
    path.join(route, 'page.tsx'),
    `'use client';
import { Button, Input } from '@bitakit/ui/components';
import { Inspector } from '@bitakit/devtools';
import { useNotifications } from '@bitakit/shell';
export default function ThemeChecks() {
  const notifications = useNotifications();
  return <section className="flex flex-col gap-4">
    <Button onClick={() => notifications?.show('Theme notification', { duration: 10000 })}>Theme button</Button>
    <Input aria-label="Theme input" />
    <Inspector plugin="todos" />
  </section>;
}
`,
  );
}

async function style(locator) {
  await locator.waitFor();
  return locator.evaluate((element) => {
    const css = getComputedStyle(element);
    return Object.fromEntries(
      [
        'backgroundColor',
        'color',
        'borderTopWidth',
        'borderRadius',
        'boxShadow',
        'fontFamily',
        'fontSize',
        'transitionDuration',
        'transitionTimingFunction',
        'backgroundImage',
      ].map((name) => [name, css[name]]),
    );
  });
}

export async function verifyDeveloperTheme(page, url, artifacts) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.dataset.appTheme = 'fixture';
    });
  });
  for (const dark of [false, true]) {
    await page.goto(url + '/settings/shell');
    const mode = page.getByRole('radio', { name: dark ? 'Dark' : 'Light', exact: true });
    await mode.click();
    await expect(mode).toHaveAttribute('aria-checked', 'true');
    await page.goto(url + '/theme-checks');
    await page.getByRole('button', { name: 'Theme button', exact: true }).waitFor();
    const button = page.getByRole('button', { name: 'Theme button', exact: true });
    await expect(button).toHaveCSS(
      'background-color',
      dark ? 'rgb(225, 175, 85)' : 'rgb(15, 90, 130)',
    );
    const shared = await style(button);
    assert.equal(shared.borderTopWidth, '3px');
    assert.equal(shared.fontSize, '16px');
    assert.match(shared.fontFamily, /Georgia/);
    assert.equal(shared.backgroundImage, 'none');
    assert.equal(shared.transitionDuration, '0.04s');
    assert.equal(shared.transitionTimingFunction, 'linear');
    assert.match(shared.boxShadow, /2px 3px/);
    assert.doesNotMatch(shared.boxShadow, /140, 55, 90/);
    await button.focus();
    await expect(button).toHaveCSS('box-shadow', /5px/);
    const field = await style(page.getByLabel('Theme input'));
    assert.equal(field.borderTopWidth, '3px');
    assert.match(field.boxShadow, /inset/);
    assert.match((await style(page.locator('[data-slot="card"]').first())).boxShadow, /4px 6px/);
    assert.match((await style(page.locator('[data-slot="sidebar-inset"]'))).boxShadow, /4px 6px/);
    await button.hover();
    await expect(button).toHaveCSS('box-shadow', /140, 55, 90/);
    await page.mouse.down();
    await expect(button).toHaveCSS('scale', '0.99');
    await expect(button).toHaveCSS('box-shadow', /40, 60, 70/);
    await page.mouse.up();
    await expect(page.getByText('Theme notification', { exact: true })).toBeVisible();
    assert.match((await style(page.locator('.toast').first())).boxShadow, /6px 8px/);
    await page.locator('.quick-search-trigger').click();
    const search = page.getByRole('dialog');
    await expect(search.locator('.quick-search')).toBeVisible();
    assert.match((await style(search)).boxShadow, /6px 8px/);
    assert.match((await style(search)).fontFamily, /Georgia/);
    assert.equal((await style(search.locator('.quick-search-item').first())).fontSize, '16px');
    await page.screenshot({
      animations: 'disabled',
      path: path.join(artifacts, `developer-search-${dark ? 'dark' : 'light'}.png`),
    });
    await page.keyboard.press('Escape');
    await search.waitFor({ state: 'hidden' });
    await page.goto(url + '/checks');
    await page.getByRole('button', { name: 'Load fixture plugin' }).click();
    assert.match((await style(page.locator('.fixture-plugin'))).fontFamily, /Georgia/);
    await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
    await page.getByRole('menu').waitFor();
    assert.match((await style(page.locator('.dropdown__popover'))).boxShadow, /6px 8px/);
    assert.match((await style(page.getByRole('menuitem').last())).fontFamily, /Georgia/);
    await page.keyboard.press('Escape');
    await page.getByRole('menu').waitFor({ state: 'hidden' });
    await page.goto(url + '/settings/shell');
    const settingsSearch = page.getByRole('textbox', { name: 'Search settings', exact: true });
    await expect(
      page.locator('[data-slot="input-group"]').filter({ has: settingsSearch }),
    ).toHaveCSS('border-top-width', '3px');
    assert.match((await style(settingsSearch)).fontFamily, /Georgia/);
    await page.goto(url + '/settings/account/security');
    await page.locator('[data-two-factor-settings]').waitFor();
    const native = page.locator('.button--primary').first();
    await expect(native).toHaveCSS(
      'background-color',
      dark ? 'rgb(225, 175, 85)' : 'rgb(15, 90, 130)',
    );
    const authButton = await style(native);
    assert.equal(authButton.borderTopWidth, '3px');
    assert.equal(authButton.backgroundImage, 'none');
    assert.equal(authButton.borderRadius, shared.borderRadius);
    assert.match(authButton.fontFamily, /Georgia/);
    assert.equal(authButton.transitionDuration, '0.04s');
    assert.match((await style(page.locator('.card').first())).boxShadow, /4px 6px/);
    assert.equal((await style(page.locator('.input-group').first())).borderTopWidth, '3px');
    await page
      .locator('[data-two-factor-settings]')
      .getByRole('button', { name: /enable/i })
      .click();
    const modal = page.getByRole('alertdialog');
    assert.match((await style(modal)).boxShadow, /6px 8px/);
    assert.match((await style(modal)).fontFamily, /Georgia/);
    await page.setViewportSize({ width: 390, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({
      animations: 'disabled',
      path: path.join(artifacts, `developer-auth-${dark ? 'dark' : 'light'}.png`),
    });
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 1280, height: 1000 });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.button--primary').first()).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
