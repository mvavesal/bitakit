import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultMessages } from '../dist/text.js';
import { settingsCategories } from '../dist/index.js';

const load = async (locale) =>
  JSON.parse(await readFile(new URL(`../locales/${locale}.json`, import.meta.url), 'utf8'));
const keys = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, entry]) =>
    entry && typeof entry === 'object' ? keys(entry, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

test('English and German catalogs have the same keys', async () => {
  const [en, de] = await Promise.all([load('en'), load('de')]);
  assert.deepEqual(keys(de).sort(), keys(en).sort());
  assert.deepEqual(Object.keys(en).sort(), ['app-preferences', 'plugins', 'settings']);
});

test('every rendered text has a catalog entry; categories and the plugin are named', async () => {
  const en = await load('en');
  assert.deepEqual(
    Object.keys(en['app-preferences'].ui).sort(),
    Object.keys(defaultMessages).sort(),
  );
  for (const [key, message] of Object.entries(defaultMessages))
    if (typeof message === 'string')
      assert.equal(en['app-preferences'].ui[key], message, `en.json repeats "${key}"`);
  assert.deepEqual(
    Object.keys(en.settings.categories),
    settingsCategories.map((category) => category.id),
  );
  assert.equal(en.plugins['app-preferences'].name, 'App Preferences');
});
