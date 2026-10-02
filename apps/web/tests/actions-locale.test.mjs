import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createJiti } from 'jiti';
import { JSDOM } from 'jsdom';
import { createElement as h, act, useEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import { createAppPreferences, SettingsProvider } from '@bitakit/app-preferences';
import { ActionButton, useActionList } from '@bitakit/ui/actions';

const jiti = createJiti(import.meta.url, {
  fsCache: false,
  alias: {
    '@/app/auth-actions': fileURLToPath(new URL('./fixtures/auth-actions.mjs', import.meta.url)),
    '@': fileURLToPath(new URL('../src', import.meta.url)),
  },
  jsx: { runtime: 'automatic' },
});
const { BitaKit } = await jiti.import('../src/components/providers/bitakit.tsx');
const { settingDefinitions } = await jiti.import('../src/settings/definitions.ts');
const messages = Object.fromEntries(
  ['en', 'de'].map((locale) => [
    locale,
    JSON.parse(readFileSync(new URL(`../locales/${locale}.json`, import.meta.url), 'utf8')),
  ]),
);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('locale changes preserve pending execution, registration ownership and the current navigation target', async () => {
  const settings = createAppPreferences({
    definitions: settingDefinitions,
    storage: {
      async load() {
        return { writable: true };
      },
      async save() {},
    },
  });
  const job = deferred();
  const navigations = [];
  const router = {
    push: (href) => navigations.push(href),
    prefetch() {},
    replace() {},
    refresh() {},
    back() {},
    forward() {},
  };
  let list,
    context,
    calls = 0;
  const definition = {
    id: 'test.pending',
    title: 'User-authored label',
    checked: true,
    async execute(ctx) {
      calls++;
      context = ctx;
      await job.promise;
      ctx.update({ description: 'Finished' });
    },
  };
  // A page-owned registration on the shared list, released with the component.
  function Probe() {
    const current = useActionList();
    list = current;
    useEffect(() => current.register(definition).unregister, [current]);
    return h(ActionButton, { action: definition.id });
  }
  const tree = (locale) =>
    h(
      StrictMode,
      null,
      h(
        NextIntlClientProvider,
        { locale, messages: messages[locale], timeZone: 'UTC' },
        h(
          AppRouterContext.Provider,
          { value: router },
          h(
            PathnameContext.Provider,
            { value: '/' },
            h(
              SearchParamsContext.Provider,
              { value: new URLSearchParams() },
              h(SettingsProvider, { settings }, h(BitaKit, null, h(Probe))),
            ),
          ),
        ),
      ),
    );
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let run;
  try {
    await act(async () => root.render(tree('en')));
    const original = list;
    await act(async () => {
      list.update('navigation.settings', { href: '/settings/language', checked: true });
      run = list.execute('test.pending');
      await Promise.resolve();
    });
    assert.equal(list.get('test.pending').pending, true);
    await act(async () => root.render(tree('de')));
    assert.equal(list, original, 'a locale change must not replace the root ActionList');
    assert.equal(list.get('test.pending').pending, true);
    assert.equal(container.querySelector('button').disabled, true);
    assert.equal(list.get('test.pending').title, 'User-authored label');
    assert.equal(list.get('test.pending').checked, true);
    assert.equal(context.get(), list.get('test.pending'));
    assert.equal(list.get('navigation.settings').title, messages.de.Nav.settings);
    assert.equal(list.get('navigation.settings').href, '/settings/language');
    assert.equal(list.get('navigation.settings').checked, true);
    await act(async () => {
      assert.deepEqual(await list.execute('test.pending'), {
        status: 'skipped',
        reason: 'pending',
      });
      assert.deepEqual(await list.execute('navigation.settings'), {
        status: 'completed',
        value: undefined,
      });
    });
    assert.deepEqual(navigations, ['/settings/language']);
    await act(async () => {
      job.resolve();
      await run;
    });
    assert.equal(calls, 1);
    assert.equal(list.get('test.pending').pending, false);
    assert.equal(list.get('test.pending').description, 'Finished');
    await act(async () => root.render(tree('en')));
    assert.equal(list, original);
    assert.equal(list.get('navigation.settings').title, messages.en.Nav.settings);
    assert.equal(list.get('test.pending').description, 'Finished');
  } finally {
    await act(async () => {
      job.resolve();
      await run;
      root.unmount();
    });
    container.remove();
    settings.deactivate();
  }
  assert.equal(
    list.get('test.pending'),
    undefined,
    'the original registration cleans up on unmount',
  );
});
