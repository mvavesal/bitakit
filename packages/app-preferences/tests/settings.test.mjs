import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppPreferences,
  SelectSetting,
  SettingsSection,
  SettingsGroup,
  NumberSetting,
  ToggleSetting,
} from '../dist/core.js';
const theme = () =>
  new SelectSetting({
    key: 'appearance.theme',
    title: 'Theme',
    defaultValue: 'system',
    options: ['light', 'dark', 'system'].map((value) => ({ value, label: value })),
  });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

test('host parent category updates remain presentation-only and cleanup is independent', async () => {
  const setting = theme();
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { writable: false };
      },
      async save() {
        assert.fail('read-only setting must not save');
      },
    },
  });
  settings.add(
    new SettingsSection({
      id: 'plugins',
      title: 'Plugins',
      category: { id: 'admin', title: 'Application Administration' },
    }),
  );
  const first = settings.add(
    new SettingsSection({
      id: 'one',
      pluginId: 'one',
      title: 'One',
      groups: [new SettingsGroup({ title: 'Preferences', items: [setting] })],
    }),
    { section: 'plugins' },
  );
  settings.add(
    new SettingsSection({ id: 'two', pluginId: 'two', title: 'Two', component: () => null }),
    { section: 'plugins' },
  );
  await settings.activate({ userId: 'member', organizationId: 'a' });
  assert.equal(settings.getSections()[1].category.id, 'admin');
  assert.equal(setting.scope, 'user');
  await assert.rejects(settings.set(setting, 'dark'), /not writable/);
  settings.updateSection('plugins', { category: { id: 'admin', title: 'Anwendungsverwaltung' } });
  assert.equal(settings.getSections()[2].category.title, 'Anwendungsverwaltung');
  first.remove();
  assert.deepEqual(
    settings.getSections().map((section) => section.id),
    ['plugins', 'two'],
  );
});

test('settings work without Actions: validate, save once, notify and retain confirmed value on errors', async () => {
  const setting = theme();
  let writes = 0;
  let notifications = 0;
  let fail = false;
  const settings = createAppPreferences({
    definitions: [setting],
    storage: {
      async load() {
        return { value: 'light', writable: true };
      },
      async save() {
        writes++;
        if (fail) throw new Error('offline');
      },
    },
  });
  const off = settings.subscribe(setting, () => notifications++);
  await settings.activate({ userId: 'one' });
  await settings.set(setting, 'dark');
  assert.equal(settings.get(setting).value, 'dark');
  assert.equal(writes, 1);
  await assert.rejects(settings.set(setting, 'invalid'));
  assert.equal(writes, 1);
  fail = true;
  await assert.rejects(settings.set(setting, 'light'), /offline/);
  assert.equal(settings.get(setting).value, 'dark');
  assert.equal(settings.get(setting).pending, false);
  const count = notifications;
  off();
  await settings.refresh(setting);
  assert.equal(count, notifications);
});

test('old tenant load and save responses cannot overwrite the new context', async () => {
  const setting = theme();
  const first = deferred();
  const write = deferred();
  const settings = createAppPreferences({
    definitions: [setting],
    storage: {
      async load(_key, context) {
        return context.organizationId === 'first'
          ? first.promise
          : { value: 'light', writable: true };
      },
      async save() {
        await write.promise;
      },
    },
  });
  const old = settings.activate({ organizationId: 'first' });
  await settings.activate({ organizationId: 'second' });
  first.resolve({ value: 'dark', writable: true });
  await old;
  assert.equal(settings.get(setting).value, 'light');
  const save = settings.set(setting, 'dark');
  await settings.activate({ organizationId: 'third' });
  write.resolve();
  await save;
  assert.equal(settings.get(setting).value, 'light');
});

test('pending guards, read-only values and refresh races', async () => {
  const setting = theme();
  const slow = deferred();
  let loadCount = 0;
  const settings = createAppPreferences({
    definitions: [setting],
    storage: {
      async load() {
        return ++loadCount === 2 ? slow.promise : { value: 'light', writable: true };
      },
      async save() {},
    },
  });
  await settings.activate({});
  const refreshing = settings.refresh(setting);
  await settings.set(setting, 'dark');
  slow.resolve({ value: 'light', writable: true });
  await refreshing;
  assert.equal(settings.get(setting).value, 'dark');
  const readonly = createAppPreferences({
    definitions: [setting],
    storage: {
      async load() {
        return { writable: false };
      },
      async save() {
        assert.fail();
      },
    },
  });
  await readonly.activate({});
  await assert.rejects(readonly.set(setting, 'dark'), /not writable/);
});

test('a late save error from the previous user cannot alter the new user value or permissions', async () => {
  const setting = theme();
  const write = deferred();
  const settings = createAppPreferences({
    definitions: [setting],
    storage: {
      async load(_key, context) {
        return {
          value: context.userId === 'one' ? 'dark' : 'light',
          writable: context.userId === 'one',
        };
      },
      async save() {
        await write.promise;
      },
    },
  });
  await settings.activate({ userId: 'one' });
  const saving = settings.set(setting, 'system');
  const failed = assert.rejects(saving, /old user request/);
  await settings.activate({ userId: 'two' });
  write.reject(new Error('old user request'));
  await failed;
  assert.equal(settings.get(setting).value, 'light');
  assert.equal(settings.get(setting).writable, false);
  assert.equal(settings.get(setting).error, undefined);
  assert.equal(settings.get(setting).pending, false);
});

test('sections, custom components and plugin pages register dynamically with owned cleanup', () => {
  const setting = theme();
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save() {},
    },
  });
  const component = () => null;
  const root = settings.add(new SettingsSection({ id: 'integrations', title: 'Integrations' }));
  const page = new SettingsSection({
    id: 'calendar',
    title: 'Calendar',
    component,
    groups: [new SettingsGroup({ title: 'Theme', items: [setting] })],
  });
  const reg = settings.add(page, { section: 'integrations' });
  assert.equal(settings.getSections()[1].component, component);
  assert.equal(settings.getSections()[1].category.id, 'integrations');
  assert.equal(settings.get(setting).value, 'system');
  assert.throws(() => settings.add(page), /Duplicate/);
  reg.remove();
  assert.equal(settings.getSections().length, 1);
  const replacement = settings.add(page);
  reg.remove();
  assert.equal(settings.getSections().length, 2);
  replacement.remove();
  root.remove();
  assert.equal(settings.getSections().length, 0);
});

test('environment defaults are parsed strictly, preserving false and zero', () => {
  const toggle = new ToggleSetting({ key: 'test.enabled', title: 'Enabled', defaultValue: true });
  assert.equal(toggle.fromEnvironment('false'), false);
  assert.throws(() => toggle.fromEnvironment('yes'));
  const number = new NumberSetting({ key: 'test.count', title: 'Count', defaultValue: 3 });
  assert.equal(number.fromEnvironment('0'), 0);
  assert.throws(() => number.fromEnvironment(''));
  assert.throws(() => theme().fromEnvironment('invalid'));
});

test('removing a plugin invalidates its pending save without touching a replacement', async () => {
  const first = theme();
  const write = deferred();
  const settings = createAppPreferences({
    storage: {
      async load() {
        return { writable: true };
      },
      async save() {
        await write.promise;
      },
    },
  });
  const page = (item) =>
    new SettingsSection({
      id: 'plugin',
      title: 'Plugin',
      groups: [new SettingsGroup({ title: 'Options', items: [item] })],
    });
  const old = settings.add(page(first));
  await settings.activate({});
  const saving = settings.set(first, 'dark');
  old.remove();
  const replacement = theme();
  settings.add(page(replacement));
  await settings.refresh(replacement);
  old.remove();
  write.resolve();
  await saving;
  assert.equal(settings.get(replacement).value, 'system');
});
