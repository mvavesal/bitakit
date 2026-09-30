import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppPreferences, createMemoryStorage } from '@bitakit/app-preferences/core';
import { languagePreferences } from '../dist/preferences.js';

test('language uses confirmed persistence, rejects failures, resets and supports configured new locales', async () => {
  const language = languagePreferences({
    locales: ['en', 'de', 'fa'].map(value => ({ value, label: value })), defaultLocale: 'de',
  });
  let persisted = 'en';
  let fail = false;
  const base = createMemoryStorage({ values: { 'shell.theme': 'dark' } });
  const storage = language.storage(base, {
    async load() { return persisted; },
    async save(value) { if (fail) throw new Error('Offline'); persisted = value; },
    async reset() { persisted = 'de'; return persisted; },
  });
  const settings = createAppPreferences({ storage, definitions: [language.setting] });
  await settings.activate({});
  assert.equal(settings.get(language.setting).value, 'en');
  await settings.set(language.setting, 'fa');
  assert.equal(settings.get(language.setting).value, 'fa');
  assert.equal(persisted, 'fa');
  fail = true;
  await assert.rejects(settings.set(language.setting, 'en'), /Offline/);
  assert.equal(settings.get(language.setting).value, 'fa');
  fail = false;
  await settings.reset(language.setting);
  assert.equal(settings.get(language.setting).value, 'de');
  assert.equal((await storage.load('shell.theme', {})).value, 'dark');
  await storage.save('shell.theme', 'light', {});
  assert.equal(base.values.get('shell.theme'), 'light');
  assert.equal(base.values.has('language.locale'), false);
  await assert.rejects(settings.set(language.setting, 'xx'));
});
