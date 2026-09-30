import { createAppPreferences } from '@bitakit/app-preferences/core';
import { themeSetting } from '../src/settings/definitions';
import { test, expect } from '@playwright/test';
import { createActionList } from '@bitakit/core/actions';
import { URLAction } from '@bitakit/core/actions';
import { NavigationHost, safeHref } from '@bitakit/core/actions';

import themeActionDefinition, {
  executeTheme,
  THEME_ACTION_ID,
} from '../src/actions/appearance/set-theme.action';
import { FoundationRuntime } from '@bitakit/core';

test('navigation uses current href and an isolated host; cleanup invalidates stale executions', async () => {
  const host = new NavigationHost();
  const navigations: string[] = [];
  const unbind = host.bind((href) => {
    navigations.push(href);
  });
  const list = createActionList([], { environment: host });
  const reg = list.register(new URLAction({ id: 'url', title: 'Open', href: '/first' }));
  reg.update({ href: '/latest#section' });
  await list.execute('url');
  expect(navigations).toEqual(['/latest#section']);
  expect(list.get('url')?.pending).toBe(false); // dispatched, not a router completion promise
  reg.update({ enabled: false });
  expect(await list.execute('url')).toMatchObject({ reason: 'disabled' });
  reg.update({ enabled: true, visible: false });
  expect(await list.execute('url')).toMatchObject({ reason: 'hidden' });
  reg.update({ visible: true });
  expect(() => reg.update({ href: 'javascript:alert(1)' })).toThrow();
  expect(list.get('url')?.href).toBe('/latest#section');
  unbind();
  await expect(list.execute('url')).rejects.toThrow('not mounted');
  reg.unregister();
  list.register(new URLAction({ id: 'url', title: 'Replacement', href: '/other' }));
  expect(reg.update({ title: 'Stale' })).toBe(false);
  reg.unregister();
  expect(list.get('url')?.title).toBe('Replacement');
  for (const href of [
    'javascript:alert(1)',
    '//evil.example',
    '/\\evil.example',
    'data:text/html,x',
    ' https://example.org',
    'https://user:password@example.org',
  ])
    expect(safeHref(href)).toBeUndefined();
  expect(safeHref('https://example.org/docs')).toBe('https://example.org/docs');
});

for (const mobile of [false, true]) {
  test(`registration updates real sidebar/settings/menu and cleans up on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/actions-demo');
    await page.getByRole('button', { name: 'Register example', exact: true }).click();
    const card = page.locator('#placement-example');
    const links = card.getByRole('link', { name: 'Example preferences', exact: true });
    await expect(links).toHaveCount(2);
    await page.getByLabel('Example title').fill('Shared preferences');
    const renamed = card.getByRole('link', { name: 'Shared preferences', exact: true });
    await expect(renamed).toHaveCount(2);
    const previousIcon = await renamed.first().locator('svg').innerHTML();
    await page.getByRole('button', { name: 'Change example icon' }).click();
    expect(await renamed.first().locator('svg').innerHTML()).not.toBe(previousIcon);
    expect(await renamed.first().locator('svg').innerHTML()).toBe(
      await renamed.last().locator('svg').innerHTML(),
    );
    await card.getByRole('button', { name: 'User menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Shared preferences' })).toHaveAttribute(
      'href',
      '/settings/example',
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Disable example' }).click();
    for (const link of await renamed.all()) {
      await expect(link).toHaveAttribute('aria-disabled', 'true');
      await expect(link).not.toHaveAttribute('href');
    }
    await card.getByRole('button', { name: 'User menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Shared preferences' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Enable example' }).click();
    await page.getByRole('button', { name: 'Hide example' }).click();
    await expect(renamed).toHaveCount(0);
    await card.getByRole('button', { name: 'User menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Shared preferences' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Show example' }).click();
    await page.getByRole('button', { name: 'Change example address' }).click();
    await expect(renamed.first()).toHaveAttribute('href', '/settings/example-updated');
    await expect(renamed.last()).toHaveAttribute('href', '/settings/example-updated');
    await renamed.first().click();
    await expect(page).toHaveURL(/\/settings\/example-updated$/);
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Shared preferences' })).toBeVisible();
    await expect(page).toHaveTitle('Shared preferences · SaaS Foundation');
    await expect(dialog.getByText('This local contribution', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close settings' }).click();
    await expect(page).toHaveURL(/\/actions-demo$/);
    await page.getByRole('button', { name: 'Remove example' }).click();
    await expect(renamed).toHaveCount(0);
    await card.getByRole('button', { name: 'User menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Shared preferences' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

test('settings links support a new tab without executing navigation in the opener', async ({
  page,
  context,
}) => {
  await page.goto('/actions-demo');
  const opened = context.waitForEvent('page');
  await page
    .getByLabel('Settings example', { exact: true })
    .getByRole('link', { name: 'Appearance', exact: true })
    .click({ button: 'middle' });
  const other = await opened;
  await other.bringToFront();
  await other.waitForURL('**/settings/appearance', { waitUntil: 'domcontentloaded' });
  // The popup starts at about:blank; wait for the real document and hydrated controls.
  await other.waitForFunction(
    () =>
      document.readyState === 'complete' &&
      document.querySelector<HTMLButtonElement>('[role=radio]')?.disabled === false,
  );
  await expect.poll(() => other.url()).toMatch(/\/settings\/appearance$/);
  // Avoid popup locator auto-wait retaining Next's same-document navigation.
  // Verify the actual rendered, hydrated document rather than weakening the assertions.
  await expect
    .poll(() =>
      other.evaluate(() => ({
        heading: document.querySelector('h1')?.textContent,
        visible: document.querySelector('h1')?.checkVisibility(),
        title: document.title,
        dialogs: document.querySelectorAll('[role=dialog]').length,
      })),
    )
    .toEqual({
      heading: 'Appearance',
      visible: true,
      title: 'Appearance · SaaS Foundation',
      dialogs: 0,
    });
  await expect(page).toHaveURL(/\/actions-demo$/);
  await other.close();
});

test('one theme action validates its parameter and honors shared execution guards', async () => {
  const selected: string[] = [];
  const settings = createAppPreferences({
    definitions: [themeSetting],
    storage: {
      async load() {
        return { value: 'system', writable: true };
      },
      async save(_key, value) {
        selected.push(String(value));
      },
    },
  });
  const list = createActionList();
  const runtime = new FoundationRuntime(
    list,
    { plugins: [{ id: 'app', actions: [themeActionDefinition] }] },
    { settings },
  );
  const disposeRuntime = runtime.mount();
  const unmount = list.mount();
  expect(await executeTheme(list, 'dark')).toMatchObject({ reason: 'disabled' });
  await settings.activate({});
  await executeTheme(list, 'light');
  await executeTheme(list, 'dark');
  await executeTheme(list, 'system');
  await expect(list.execute(THEME_ACTION_ID, 'invalid')).rejects.toThrow('Invalid');
  await expect(list.execute(THEME_ACTION_ID)).rejects.toThrow('Invalid');
  expect(selected).toEqual(['light', 'dark', 'system']);
  list.update(THEME_ACTION_ID, { visible: false });
  expect(await executeTheme(list, 'light')).toMatchObject({ reason: 'hidden' });
  expect(selected).toHaveLength(3);
  unmount();
  disposeRuntime();
  settings.deactivate();
});
