import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  createAppPreferences,
  createLocalStorage,
  createMemoryStorage,
  defineSettings,
  defineSettingsSection,
  booleanField,
  choiceField,
  numberField,
  textField,
  SelectSetting,
  SettingValidationError,
} from '../dist/core.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const editor = () =>
  defineSettings({
    id: 'editor',
    fields: {
      autosave: booleanField({ defaultValue: true, presentation: { order: 20 } }),
      pageSize: numberField({
        defaultValue: 20,
        schema: z.number().int().min(5, 'Use at least 5 rows.').max(100),
      }),
      density: choiceField({
        options: ['comfortable', 'compact'],
        defaultValue: 'comfortable',
        presentation: { order: 10, variant: 'cards' },
      }),
    },
  });

test('collections derive stable keys, types and titles independently of files', () => {
  const settings = editor();
  assert.deepEqual(
    settings.settings.map((setting) => [
      setting.key,
      setting.type,
      setting.title,
      setting.collection,
    ]),
    [
      ['editor.autosave', 'boolean', 'Autosave', 'editor'],
      ['editor.pageSize', 'number', 'Page size', 'editor'],
      ['editor.density', 'choice', 'Density', 'editor'],
    ],
  );
  assert.ok(settings.fields.density instanceof SelectSetting);
  assert.deepEqual(
    settings.fields.density.options.map((option) => option.label),
    ['Comfortable', 'Compact'],
  );
  assert.equal(settings.fields.pageSize.scope, 'user');
  assert.throws(
    () => defineSettings({ id: 'Editor', fields: {} }),
    /Invalid settings collection ID "Editor"/,
  );
  assert.throws(
    () =>
      defineSettings({ id: 'editor', fields: { 'page-size': numberField({ defaultValue: 1 }) } }),
    /Invalid field name "page-size" in settings collection "editor"/,
  );
  assert.throws(
    () => defineSettings({ id: 'editor', fields: { plain: { defaultValue: 1 } } }),
    /must use a field builder/,
  );
  assert.throws(
    () =>
      defineSettings({
        id: 'editor',
        fields: { mode: choiceField({ options: ['a'], defaultValue: 'b' }) },
      }),
    /Invalid option for editor.mode/,
  );
});

test('Standard Schema validators check writes and stored values; issues stay user-facing', async () => {
  const settings = editor();
  const storage = createMemoryStorage({ values: { 'editor.pageSize': 500 } });
  const app = createAppPreferences({ storage });
  app.register(settings, { owner: 'editor' });
  await app.activate({});
  const pageSize = settings.fields.pageSize;
  assert.equal(app.get(pageSize).ready, false, 'an invalid stored value is not confirmed');
  assert.match(app.get(pageSize).error, /Invalid value for editor.pageSize/);
  storage.values.delete?.('editor.pageSize');
  const valid = createAppPreferences({ storage: createMemoryStorage() });
  valid.register(settings, { owner: 'editor' });
  await valid.activate({});
  await assert.rejects(valid.set(pageSize, 2), (error) => {
    assert.ok(error instanceof SettingValidationError);
    assert.equal(error.issue, 'Use at least 5 rows.');
    return true;
  });
  assert.equal(await valid.set(pageSize, 50), 'saved');
  assert.equal(valid.get(pageSize).value, 50);
});

test('owner registration is reference-aware and independent of sections', async () => {
  const settings = editor();
  const storage = createMemoryStorage({ values: { 'editor.autosave': false } });
  let deletes = 0;
  const app = createAppPreferences({
    storage: { ...storage, reset: async (...args) => (deletes++, storage.reset(...args)) },
  });
  const section = defineSettingsSection({ id: 'editor', title: 'Editor', settings: [settings] });
  const plugin = app.register(settings, { owner: 'editor', origin: 'settings/editor.ts (editor)' });
  const again = app.register(settings, { owner: 'app' });
  assert.deepEqual(app.ownersOf(settings.fields.autosave), ['editor', 'app']);
  const catalog = app.add(section);
  catalog.remove();
  assert.ok(app.has(settings.fields.autosave), 'removing a section keeps owned definitions');
  plugin.remove();
  assert.deepEqual(app.ownersOf(settings.fields.autosave), ['app']);
  assert.ok(app.has(settings.fields.autosave));
  again.remove();
  assert.equal(app.has(settings.fields.autosave), false);
  assert.equal(deletes, 0, 'unregistering never deletes persisted values');
  assert.equal(storage.values.get('editor.autosave'), false);
  app.register(settings, { owner: 'editor', origin: 'settings/editor.ts (editor)' });
  assert.throws(
    () => app.register(editor(), { owner: 'other', origin: 'settings/copy.ts (other)' }),
    /Duplicate settings collection "editor": settings\/editor.ts \(editor\) and settings\/copy.ts \(other\)/,
  );
  const clash = defineSettings({ id: 'editor2', fields: {} });
  app.register(clash, { owner: 'x' });
  const foreign = new SelectSetting({
    key: 'editor.density',
    title: 'Density',
    defaultValue: 'a',
    options: [{ value: 'a', label: 'A' }],
  });
  assert.throws(
    () => app.register(foreign, { owner: 'other', origin: 'setup of "other"' }),
    /Duplicate setting "editor.density": settings\/editor.ts \(editor\) and setup of "other"/,
  );
});

test('sections order fields by order, then collection order, then declaration order', () => {
  const first = defineSettings({
    id: 'first',
    fields: {
      a: textField({ defaultValue: '' }),
      b: textField({ defaultValue: '', presentation: { order: 2 } }),
      c: textField({ defaultValue: '' }),
    },
  });
  const second = defineSettings({
    id: 'second',
    fields: {
      d: textField({ defaultValue: '', presentation: { order: 1 } }),
      e: textField({ defaultValue: '' }),
    },
  });
  const section = defineSettingsSection({
    id: 'mixed',
    title: { key: 'mixed.title', fallback: 'Mixed' },
    settings: [first, second],
  });
  assert.deepEqual(
    section.fields.map((field) => field.key),
    ['second.d', 'first.b', 'first.a', 'first.c', 'second.e'],
  );
  assert.equal(section.title, 'Mixed');
  assert.equal(section.titleKey, 'mixed.title');
  assert.throws(
    () => defineSettingsSection({ id: 'x', title: 'X', settings: [{}] }),
    /Expected a settings collection/,
  );
});

test('writes queue per key: one in flight, newer values coalesce and promises settle predictably', async () => {
  const settings = editor();
  const writes = [];
  const gates = [];
  const app = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save(key, value) {
        writes.push(value);
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
      },
    },
  });
  app.register(settings, { owner: 'editor' });
  await app.activate({});
  const size = settings.fields.pageSize;
  const first = app.set(size, 30);
  const second = app.set(size, 40);
  const third = app.set(size, 50);
  assert.deepEqual(writes, [30], 'only one write is in flight');
  assert.equal(app.get(size).pending, true);
  assert.equal(app.get(size).value, 20, 'pending values are not confirmed');
  let secondResult;
  second.then((result) => (secondResult = result));
  gates[0].resolve();
  assert.equal(await first, 'saved');
  await new Promise((resolve) => setTimeout(resolve));
  assert.deepEqual(writes, [30, 50], 'the queued value was replaced by the newest one');
  assert.equal(secondResult, undefined, 'superseded writes resolve once the key settles');
  assert.equal(app.get(size).value, 30);
  gates[1].resolve();
  assert.equal(await third, 'saved');
  assert.equal(await second, 'superseded');
  assert.equal(app.get(size).value, 50);
  assert.equal(app.get(size).pending, false);
});

test('a failed write rejects only its own promise and never confirms; the queue continues', async () => {
  const settings = editor();
  const gates = [];
  const app = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save(_key, value) {
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
        if (value === 30) throw new Error('backend rejected');
      },
    },
  });
  app.register(settings, { owner: 'editor' });
  await app.activate({});
  const size = settings.fields.pageSize;
  const failing = app.set(size, 30);
  const next = app.set(size, 60);
  gates[0].resolve();
  await assert.rejects(failing, /backend rejected/);
  assert.equal(app.get(size).value, 20);
  await new Promise((resolve) => setTimeout(resolve));
  gates[1].resolve();
  assert.equal(await next, 'saved');
  assert.equal(app.get(size).value, 60);
  assert.equal(app.get(size).error, undefined);
});

test('context changes cancel queued writes and ignore late results without touching the new context', async () => {
  const settings = editor();
  const gates = [];
  const app = createAppPreferences({
    storage: {
      async load(_key, context) {
        return { value: context.userId === 'two' ? 70 : undefined, writable: true };
      },
      async save() {
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
      },
    },
  });
  app.register(settings, { owner: 'editor' });
  await app.activate({ userId: 'one' });
  const size = settings.fields.pageSize;
  const inFlight = app.set(size, 30);
  const queued = app.set(size, 40);
  await app.activate({ userId: 'two' });
  assert.equal(await queued, 'cancelled');
  gates[0].resolve();
  assert.equal(await inFlight, 'cancelled', 'a late success is reported as cancelled');
  assert.equal(app.get(size).value, 70);
  assert.equal(app.get(size).pending, false);
  const failing = app.set(size, 80);
  const rejected = assert.rejects(failing, /stale failure/);
  await app.activate({ userId: 'three' });
  gates[1].reject(new Error('stale failure'));
  await rejected;
  assert.equal(app.get(size).error, undefined);
  app.deactivate();
  await assert.rejects(app.set(size, 90), /not writable/);
});

test('a replaced definition waits for the previous write of the same key', async () => {
  const writes = [];
  const gate = deferred();
  const app = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save(_key, value) {
        writes.push(`start ${value}`);
        if (value === 'old') await gate.promise;
        writes.push(`end ${value}`);
      },
    },
  });
  const make = () =>
    defineSettings({ id: 'hot', fields: { mode: textField({ defaultValue: 'initial' }) } });
  const original = make();
  const first = app.register(original, { owner: 'hot' });
  await app.activate({});
  const old = app.set(original.fields.mode, 'old');
  first.remove();
  const replacement = make();
  app.register(replacement, { owner: 'hot' });
  await new Promise((resolve) => setTimeout(resolve));
  const next = app.set(replacement.fields.mode, 'new');
  await new Promise((resolve) => setTimeout(resolve));
  assert.deepEqual(writes, ['start old']);
  gate.resolve();
  assert.equal(await old, 'cancelled');
  assert.equal(await next, 'saved');
  assert.deepEqual(writes, ['start old', 'end old', 'start new', 'end new']);
});

test('reset uses storage.reset when available and otherwise saves the default', async () => {
  const settings = editor();
  const memory = createMemoryStorage({ values: { 'editor.pageSize': 40 } });
  const app = createAppPreferences({ storage: memory });
  app.register(settings, { owner: 'editor' });
  await app.activate({});
  assert.equal(app.get(settings.fields.pageSize).value, 40);
  assert.equal(await app.reset(settings.fields.pageSize), 'saved');
  assert.equal(app.get(settings.fields.pageSize).value, 20);
  assert.equal(memory.values.has('editor.pageSize'), false);
  const saved = [];
  const fallback = createAppPreferences({
    storage: {
      async load() {
        return { value: 40, writable: true };
      },
      async save(key, value) {
        saved.push([key, value]);
      },
    },
  });
  fallback.register(settings, { owner: 'editor' });
  await fallback.activate({});
  await fallback.reset(settings.fields.pageSize);
  assert.deepEqual(saved, [['editor.pageSize', 20]]);
  assert.equal(fallback.get(settings.fields.pageSize).value, 20);
});

test('activation loads all keys through one loadMany request and falls back per missing key', async () => {
  const settings = editor();
  const calls = [];
  const app = createAppPreferences({
    storage: {
      async load(key) {
        calls.push(`load ${key}`);
        return { value: 'compact', writable: false };
      },
      async loadMany(keys) {
        calls.push(`loadMany ${keys.join(',')}`);
        return {
          'editor.autosave': { value: false, writable: true },
          'editor.pageSize': { writable: true },
        };
      },
      async save() {},
    },
  });
  app.register(settings, { owner: 'editor' });
  await app.activate({ userId: 'one' });
  assert.deepEqual(calls, [
    'loadMany editor.autosave,editor.pageSize,editor.density',
    'load editor.density',
  ]);
  assert.equal(app.get(settings.fields.autosave).value, false);
  assert.equal(app.get(settings.fields.density).writable, false);
  const later = defineSettings({
    id: 'later',
    fields: { flag: booleanField({ defaultValue: false }) },
  });
  app.register(later, { owner: 'later' });
  await new Promise((resolve) => setTimeout(resolve));
  assert.equal(calls.at(-1), 'load later.flag');
});

test('local storage keeps existing keys, tolerates corrupt data and rejects failed writes', async () => {
  const data = new Map([
    ['demo.settings.shell.theme', '"dark"'],
    ['demo.settings.shell.layout', '{broken'],
  ]);
  let fail = false;
  const store = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (fail) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key) => data.delete(key),
  };
  const storage = createLocalStorage({ prefix: 'demo.settings.', store });
  assert.deepEqual(await storage.load('shell.theme', {}), { value: 'dark', writable: true });
  assert.deepEqual(await storage.load('shell.layout', {}), { value: undefined, writable: true });
  const theme = new SelectSetting({
    key: 'shell.theme',
    title: 'Theme',
    defaultValue: 'system',
    options: ['light', 'dark', 'system'].map((value) => ({ value, label: value })),
  });
  const app = createAppPreferences({ storage });
  app.register(theme, { owner: 'shell' });
  await app.activate({});
  fail = true;
  await assert.rejects(app.set(theme, 'light'), /QuotaExceededError/);
  assert.equal(app.get(theme).value, 'dark');
  assert.equal(data.get('demo.settings.shell.theme'), '"dark"');
  fail = false;
  await app.reset(theme);
  assert.equal(data.has('demo.settings.shell.theme'), false);
  const scoped = createLocalStorage({
    prefix: 'p.',
    store,
    namespace: (context) => context.userId,
  });
  await scoped.save('a.b', true, { userId: 'u1' });
  assert.equal(data.get('p.u1.a.b'), 'true');
  const unavailable = createLocalStorage({ prefix: 'x.' });
  assert.deepEqual(await unavailable.load('a.b', {}), { writable: false });
  await assert.rejects(unavailable.save('a.b', 1, {}), /not available/);
});

test('multiple choices validate, persist, reload and preserve immutable confirmed values', async () => {
  const { multiChoiceField, defineSettings, createAppPreferences, createLocalStorage } =
    await import('../dist/core.js');
  const data = new Map();
  const store = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const collection = defineSettings({
    id: 'features',
    fields: {
      enabled: multiChoiceField({
        options: ['search', 'export'],
        defaultValue: [],
        presentation: { variant: 'cards', orientation: 'horizontal' },
      }),
    },
  });
  const settings = createAppPreferences({
    storage: createLocalStorage({ prefix: 'existing.', store }),
  });
  settings.register(collection, { owner: 'app' });
  await settings.activate({});
  const value = ['search'];
  await settings.set(collection.fields.enabled, value);
  value.push('invalid');
  assert.deepEqual(settings.get(collection.fields.enabled).value, ['search']);
  assert.equal(data.get('existing.features.enabled'), '["search"]');
  await assert.rejects(settings.set(collection.fields.enabled, ['unknown']));
  await settings.activate({ userId: 'next' });
  assert.deepEqual(settings.get(collection.fields.enabled).value, ['search']);
});
