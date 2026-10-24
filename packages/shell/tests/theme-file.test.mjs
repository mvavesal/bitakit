import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mount, settle, click } from './support.mjs';
import { act, createElement as h } from 'react';
import { createMemorySettingsStorage } from '@bitakit/core';
import { BitaKitRuntimeProvider, useBitaKit, useSettingsCatalog } from '@bitakit/ui';
import { shellPlugin } from '../dist/index.js';
import {
  parseThemeFile,
  stringifyThemeFile,
  themeCatalog,
  themeFileSchemaUrl,
} from '../dist/themes.js';
import { bundledThemes } from '../dist/bundled-themes.js';
import { AppearanceSettings } from '../dist/ui/settings/appearance.js';

const base = { schemaVersion: 1, id: 'ocean', name: 'Ocean' };

test('every bundled theme survives a download and import', () => {
  for (const theme of bundledThemes) {
    const text = stringifyThemeFile({ shared: {}, light: {}, dark: {}, ...theme });
    assert.equal(JSON.parse(text).$schema, themeFileSchemaUrl);
    assert.deepEqual(parseThemeFile(text), {
      schemaVersion: 1,
      id: theme.id,
      name: theme.name,
      shared: theme.shared ?? {},
      light: theme.light ?? {},
      dark: theme.dark ?? {},
    });
  }
});

test('theme files accept only known tokens and values that load nothing', () => {
  const parsed = parseThemeFile(
    JSON.stringify({ $schema: themeFileSchemaUrl, ...base, light: { primary: '#123' } }),
  );
  assert.deepEqual(parsed, { ...base, shared: {}, light: { primary: '#123' }, dark: {} });
  for (const value of [
    'url(https://example.com/pixel.png)',
    'URL( https://example.com/pixel.png)',
    '-webkit-image-set("a.png" 1x)',
    'cross-fade(red, blue)',
    '\\75 rl(https://example.com)',
    'red; color: blue',
    'red } body { color: blue',
    '@import "x.css"',
  ])
    assert.throws(
      () => parseThemeFile(JSON.stringify({ ...base, light: { primary: value } })),
      /Invalid theme file at "light\.primary"/,
      value,
    );
  assert.throws(
    () => parseThemeFile(JSON.stringify({ ...base, dark: { 'not-a-token': 'red' } })),
    /Invalid theme file at "dark": Unrecognized key: "not-a-token"/,
  );
  assert.throws(() => parseThemeFile('{'), /not valid JSON/);
  assert.throws(() => parseThemeFile(JSON.stringify({ ...base, extra: 1 })), /"extra"/);
  assert.throws(
    () => parseThemeFile(JSON.stringify({ ...base, schemaVersion: 2 })),
    /"schemaVersion"/,
  );
});

test('a downloaded file works unchanged as an app theme in src/themes', () => {
  const file = JSON.parse(stringifyThemeFile({ ...base, shared: {}, light: {}, dark: {} }));
  assert.equal(file.$schema, themeFileSchemaUrl);
  // Discovery passes src/themes/*.json as the Shell `themes` option.
  assert.doesNotThrow(() => shellPlugin({ themes: [file] }));
  const [entry] = themeCatalog({ app: [file] });
  assert.equal(entry.key, 'app:ocean');
  assert.equal('$schema' in entry, false);
});

test('the published JSON Schema enforces the same token names and value rule', async () => {
  const schema = JSON.parse(
    await readFile(new URL('../dist/theme.schema.json', import.meta.url), 'utf8'),
  );
  assert.equal(schema.$id, themeFileSchemaUrl);
  assert.deepEqual(schema.required, ['schemaVersion', 'id', 'name']);
  for (const group of ['shared', 'light', 'dark']) {
    const tokens = schema.properties[group];
    assert.ok(tokens.propertyNames.enum.includes('primary'));
    assert.equal(tokens.propertyNames.enum.includes('not-a-token'), false);
    const pattern = new RegExp(tokens.additionalProperties.pattern);
    assert.equal(pattern.test('oklch(0.44 0.1 245)'), true);
    assert.equal(pattern.test('var(--card)'), true);
    assert.equal(pattern.test('url(https://example.com/pixel.png)'), false);
  }
});

/** The Appearance page with a real runtime and memory settings storage. */
async function appearance() {
  let runtime;
  function Page() {
    runtime = useBitaKit().runtime;
    const section = useSettingsCatalog().find((entry) => entry.id === 'shell');
    return section ? h(AppearanceSettings, { section }) : null;
  }
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      {
        config: { plugins: [shellPlugin()] },
        services: { 'settings.storage': createMemorySettingsStorage() },
      },
      h(Page),
    ),
  );
  await settle();
  const button = (label) => view.container.querySelector(`button[aria-label="${label}"]`);
  async function choose(text) {
    const input = view.container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File([text], 'theme.json', { type: 'application/json' })],
    });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await settle();
  }
  return { view, runtime: () => runtime, button, choose };
}

test('an imported file opens as an unsaved personal copy and saves through the copy Action', async () => {
  const page = await appearance();
  try {
    assert.ok(page.button('Import theme'));
    await page.choose(
      '{"schemaVersion": 1, "id": "x", "name": "Bad", "light": {"primary": "url(x)"}}',
    );
    assert.match(page.view.container.textContent, /This file is not a valid theme\./);
    assert.equal(page.view.container.querySelector('#theme-name'), null, 'no draft opened');

    await page.choose(
      stringifyThemeFile({ ...base, shared: {}, light: { primary: '#123456' }, dark: {} }),
    );
    assert.doesNotMatch(page.view.container.textContent, /not a valid theme/);
    assert.equal(page.view.container.querySelector('#theme-name').value, 'Ocean');
    const themes = page.runtime().services.themes;
    assert.equal(themes.active().key, 'shell:default', 'nothing is saved before confirming');

    const save = [...page.view.container.querySelectorAll('button')].find(
      (element) => element.textContent === 'Save copy and apply',
    );
    await click(save);
    await settle();
    const active = themes.active();
    assert.equal(active.source, 'user');
    assert.equal(active.name, 'Ocean');
    assert.notEqual(active.id, 'ocean', 'imports get a fresh personal id');
    assert.deepEqual(active.light, { primary: '#123456' });
  } finally {
    await page.view.unmount();
  }
});

test('download writes the shown theme as a named theme file', async () => {
  const page = await appearance();
  const created = [];
  const { createObjectURL, revokeObjectURL } = URL;
  const anchorClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => (created.push(blob), 'blob:theme');
  URL.revokeObjectURL = () => {};
  const downloads = [];
  HTMLAnchorElement.prototype.click = function () {
    downloads.push({ href: this.href, name: this.download });
  };
  try {
    assert.equal(page.button('Download theme').disabled, true, 'App default has no tokens');
    const themes = page.runtime().services.themes;
    await act(() => themes.select('shell:ocean-blue'));
    await settle();
    await click(page.button('Download theme'));
    assert.deepEqual(downloads, [{ href: 'blob:theme', name: 'ocean-blue.theme.json' }]);
    const file = parseThemeFile(await created[0].text());
    assert.equal(file.id, 'ocean-blue');
    assert.deepEqual(file.light, bundledThemes.find((theme) => theme.id === 'ocean-blue').light);
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    HTMLAnchorElement.prototype.click = anchorClick;
    await page.view.unmount();
  }
});
