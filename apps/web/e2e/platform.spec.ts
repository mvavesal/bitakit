import { createAppPreferences } from '@bitakit/app-preferences/core';
import { createRuntime, type ActionId } from '@bitakit/core';
import { createActionList, NavigationHost, URLAction, safeHref } from '@bitakit/core/actions';
import { test, expect } from '@playwright/test';
import themeAction from '../src/actions/theme/set';
import themeService from '../src/services/theme';
import { themeSetting } from '../src/settings/definitions';

test('navigation uses current href and an isolated host; cleanup invalidates stale executions', async () => {
  const host = new NavigationHost();
  const navigations: string[] = [];
  const unbind = host.bind((href) => {
    navigations.push(href);
  });
  const list = createActionList([], { environment: host });
  // An ad-hoc registration outside discovery; strict action IDs only know discovered actions.
  const url = 'url' as unknown as ActionId;
  const reg = list.register(new URLAction({ id: url, title: 'Open', href: '/first' }));
  reg.update({ href: '/latest#section' });
  await list.execute(url);
  expect(navigations).toEqual(['/latest#section']);
  expect(list.get(url)?.pending).toBe(false); // dispatched, not a router completion promise
  reg.update({ enabled: false });
  expect(await list.execute(url)).toMatchObject({ reason: 'disabled' });
  reg.update({ enabled: true, visible: false });
  expect(await list.execute(url)).toMatchObject({ reason: 'hidden' });
  reg.update({ visible: true });
  expect(() => reg.update({ href: 'javascript:alert(1)' })).toThrow();
  expect(list.get(url)?.href).toBe('/latest#section');
  unbind();
  await expect(list.execute(url)).rejects.toThrow('not mounted');
  reg.unregister();
  list.register(new URLAction({ id: url, title: 'Replacement', href: '/other' }));
  expect(reg.update({ title: 'Stale' })).toBe(false);
  reg.unregister();
  expect(list.get(url)?.title).toBe('Replacement');
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

test('the theme action follows the preference, validates its parameter and honors shared execution guards', async () => {
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
  // The same files discovery wires, composed by hand with the host-owned preferences.
  const compose = (actionOverrides?: { 'theme.set': { visible: false } }) => {
    const list = createActionList();
    const runtime = createRuntime(
      { services: { theme: themeService }, actions: { 'theme.set': themeAction }, actionOverrides },
      { actions: list, services: { settings } },
    );
    const stop = runtime.mount();
    const unmount = list.mount();
    return { list, stop: () => (unmount(), stop()) };
  };
  const { list, stop } = compose();
  expect(await list.execute('theme.set', 'dark')).toMatchObject({ reason: 'disabled' });
  await settings.activate({});
  expect(list.get('theme.set')?.enabled).toBe(true);
  await list.execute('theme.set', 'light');
  await list.execute('theme.set', 'dark');
  await list.execute('theme.set', 'system');
  await expect(list.execute('theme.set', 'invalid' as never)).rejects.toThrow('Invalid');
  await expect(list.execute('theme.set')).rejects.toThrow('Invalid');
  expect(selected).toEqual(['light', 'dark', 'system']);
  stop();
  // A configured cap wins over the reactive presentation.
  const hidden = compose({ 'theme.set': { visible: false } });
  expect(await hidden.list.execute('theme.set', 'light')).toMatchObject({ reason: 'hidden' });
  expect(selected).toHaveLength(3);
  hidden.stop();
  settings.deactivate();
});
