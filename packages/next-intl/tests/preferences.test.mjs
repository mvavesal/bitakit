import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySettingsStorage, createRuntime } from '@bitakit/core';
import { languagePreferences } from '../dist/preferences.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('language uses confirmed persistence, rejects failures, resets and keeps other keys in the base storage', async () => {
  const language = languagePreferences({
    locales: ['en', 'de', 'fa'].map((value) => ({ value, label: value })),
    defaultLocale: 'de',
  });
  assert.equal(language.key, 'language.locale');
  assert.equal(language.plugin.settings.settings.locale.default, 'de');
  assert.deepEqual(
    language.plugin.settings.settings.locale.options.map((option) => option.value),
    ['en', 'de', 'fa'],
  );
  let persisted = 'en';
  let fail = false;
  const base = createMemorySettingsStorage({ 'shell.mode': 'dark' });
  const storage = language.storage(base, {
    async load() {
      return persisted;
    },
    async save(value) {
      if (fail) throw new Error('Offline');
      persisted = value;
    },
    async reset() {
      persisted = 'de';
      return persisted;
    },
  });
  const runtime = createRuntime(
    { plugins: [language.plugin] },
    { services: { 'settings.storage': storage } },
  );
  const stop = runtime.mount();
  try {
    await runtime.ready;
    await tick();
    const settings = runtime.settings;
    assert.equal(settings.get(language.key), 'en', 'the persisted locale wins over the default');
    await settings.set(language.key, 'fa');
    assert.equal(settings.get(language.key), 'fa');
    assert.equal(persisted, 'fa');
    fail = true;
    await assert.rejects(settings.set(language.key, 'en'), /Offline/);
    assert.equal(settings.get(language.key), 'fa', 'a failed write keeps the confirmed value');
    fail = false;
    await settings.reset(language.key);
    assert.equal(settings.get(language.key), 'de');
    await assert.rejects(settings.set(language.key, 'xx'), /accepts/);
    const context = { scope: 'user' };
    assert.equal((await storage.load('shell.mode', context)).value, 'dark');
    await storage.save('shell.mode', 'light', context);
    assert.equal(base.data.get('user:anonymous/shell.mode'), 'light');
    assert.equal(
      [...base.data.keys()].some((key) => key.endsWith('language.locale')),
      false,
    );
  } finally {
    stop();
  }
});
