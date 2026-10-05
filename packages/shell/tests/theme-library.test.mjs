import test from 'node:test';
import assert from 'node:assert/strict';
import { FoundationRuntime, createActionList, createMemorySettingsStorage } from '@bitakit/ui';
import { shellPlugin } from '../dist/index.js';
import { themeCatalog, defaultTheme, themeTokens } from '../dist/themes.js';

const custom = { schemaVersion: 1, id: 'custom', name: 'BitaKit Default', shared: { radius: '1rem' }, light: {}, dark: {} };

test('theme identity includes source and never uses the display name', () => {
  const entries = themeCatalog({ shell: [defaultTheme], app: [{ ...defaultTheme }], user: [custom] });
  assert.deepEqual(entries.map(({ key }) => key), ['shell:default', 'app:default', 'user:custom']);
  assert.throws(() => themeCatalog({ app: [custom, custom] }), /Duplicate theme identity/);
});

test('theme service uses Core settings persistence and keeps original themes immutable', async () => {
  const storage = createMemorySettingsStorage();
  async function boot() {
    const runtime = new FoundationRuntime(createActionList(), { plugins: [shellPlugin({ themes: [custom] })] }, { 'settings.storage': storage });
    const stop = runtime.mount();
    await runtime.ready;
    // Settings loads are intentionally independent of service startup.
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { runtime, stop };
  }
  const first = await boot();
  try {
    const themes = first.runtime.services.themes;
    assert.equal(themes.active().key, 'shell:default');
    assert.equal(await themes.select('app:custom'), 'saved');
    assert.equal(await themes.saveCopy({ ...custom, id: 'personal' }), 'saved');
    assert.equal(themes.active().key, 'user:personal');
    assert.equal(themes.list().find((entry) => entry.key === 'app:custom').id, 'custom');
    assert.throws(() => themes.saveCopy({ ...custom, id: 'personal' }), /Duplicate/);
    assert.throws(() => themes.select('missing'), /Unknown theme/);
    assert.equal(await themes.update({ ...custom, id: 'personal', name: 'Revised' }), 'saved');
    assert.equal(themes.active().name, 'Revised');
    assert.throws(() => themes.update({ ...custom, id: 'default' }), /Only personal/);
  } finally { first.stop(); }
  const second = await boot();
  try {
    const themes = second.runtime.services.themes;
    assert.equal(themes.active().key, 'user:personal');
    assert.throws(() => themes.remove('default'), /Only personal/);
    assert.equal(await themes.remove('personal'), 'saved');
    assert.equal(themes.active().key, 'shell:default');
    assert.equal(themes.list().some((theme) => theme.key === 'user:personal'), false);
  } finally { second.stop(); }
});

 test('disabled surface shadow remains composable with card border rings', () => {
  assert.equal(themeTokens({ ...defaultTheme, shared: { 'theme-shadow-surface': 'none' } }, 'light')['theme-shadow-surface'], '0 0 #0000');
 });
