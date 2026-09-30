import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import { AppPreferences, Setting } from '../dist/core.js';
import { bindSettings } from '../dist/actions.js';

test('shared adapter mirrors confirmed values, write access and pending; failures remain retryable', async () => {
  const setting = new Setting({
    key: 'test.theme',
    title: 'Theme',
    defaultValue: 'light',
  });
  let finish,
    fail = false;
  const settings = new AppPreferences(
    {
      async load() {
        return { value: 'dark', writable: true };
      },
      async save() {
        await new Promise((resolve) => {
          finish = resolve;
        });
        if (fail) throw new Error('Save failed');
      },
    },
    [setting],
  );
  const list = createActionList();
  list.register(bindSettings(settings)({ id: 'theme.set', title: 'Theme', setting }));
  const unmount = list.mount();
  assert.equal(list.get('theme.set').enabled, false);
  await settings.activate({});
  assert.equal(list.get('theme.set').value, 'dark');
  const pending = list.execute('theme.set', 'light');
  assert.equal(list.get('theme.set').value, 'dark');
  assert.equal(list.get('theme.set').enabled, false);
  finish();
  await pending;
  assert.equal(list.get('theme.set').value, 'light');
  fail = true;
  const rejected = list.execute('theme.set', 'dark');
  finish();
  await assert.rejects(rejected, /Save failed/);
  assert.equal(list.get('theme.set').value, 'light');
  assert.equal(list.get('theme.set').enabled, true);
  unmount();
  settings.deactivate();
});

test('external writes sync and remount cleans subscriptions without reloading settings', async () => {
  const setting = new Setting({
    key: 'test.locale',
    title: 'Language',
    defaultValue: 'en',
  });
  let loads = 0,
    subscribers = 0;
  const settings = new AppPreferences(
    {
      async load() {
        loads++;
        return { writable: true };
      },
      async save() {},
    },
    [setting],
  );
  const subscribe = settings.subscribe;
  settings.subscribe = (...args) => {
    subscribers++;
    const off = subscribe(...args);
    return () => {
      subscribers--;
      off();
    };
  };
  const list = createActionList();
  const registration = list.register(
    bindSettings(settings)({ id: 'locale.set', title: 'Language', setting }),
  );
  let unmount = list.mount();
  await settings.activate({});
  await settings.set(setting, 'de');
  assert.equal(list.get('locale.set').value, 'de');
  unmount();
  assert.equal(subscribers, 0);
  unmount = list.mount();
  assert.equal(subscribers, 1);
  assert.equal(loads, 1);
  registration.unregister();
  assert.equal(subscribers, 0);
  unmount();
  settings.deactivate();
});

test('read-only settings stay disabled and a failed initial connection leaks no subscription', async () => {
  const setting = new Setting({
    key: 'test.locked',
    title: 'Locked',
    defaultValue: false,
  });
  const settings = new AppPreferences(
    {
      async load() {
        return { writable: false };
      },
      async save() {
        throw new Error('Unexpected save');
      },
    },
    [setting],
  );
  await settings.activate({});
  const list = createActionList();
  list.register(bindSettings(settings)({ id: 'locked', title: 'Locked', setting }));
  const unmount = list.mount();
  assert.equal((await list.execute('locked', true)).reason, 'disabled');
  unmount();
  settings.deactivate();
  const missing = new Setting({
    key: 'test.missing',
    title: 'Missing',
    defaultValue: false,
  });
  let count = 0;
  const subscribe = settings.subscribe;
  settings.subscribe = (...args) => {
    count++;
    const off = subscribe(...args);
    return () => {
      count--;
      off();
    };
  };
  const bad = createActionList([
    bindSettings(settings)({
      id: 'missing',
      title: 'Missing',
      setting: missing,
    }),
  ]);
  assert.throws(() => bad.mount(), /Unregistered setting/);
  assert.equal(count, 0);
});
