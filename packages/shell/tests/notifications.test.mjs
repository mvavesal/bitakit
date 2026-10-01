import test from 'node:test';
import assert from 'node:assert/strict';
import { toast } from '@heroui/react';
import { FoundationRuntime, createActionList } from '@bitakit/core';
import { createAppPreferences, createMemoryStorage } from '@bitakit/app-preferences/core';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import { shellPlugin, notificationPreferences } from '../dist/index.js';

function mount(notifications) {
  const settings = createAppPreferences({ storage: createMemoryStorage() });
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [appPreferencesPlugin({ settings }), shellPlugin({ notifications })],
  });
  return { settings, runtime, stop: runtime.mount() };
}

test('public notification service uses the native HeroUI queue and is disposed with Shell', async () => {
  toast.clear();
  const { runtime, stop, settings } = mount(true);
  await settings.activate({ userId: 'notifications-test' });
  const service = runtime.app.services.notifications;
  const first = service.show('Saved', { type: 'success', duration: 0 });
  const second = service.show('Retry', { type: 'error', duration: 0 });
  const native = toast.info('Native source', { timeout: 0 });
  const queue = toast.getQueue().visibleToasts;
  assert.deepEqual(
    queue.map((item) => item.content.title),
    ['Native source', 'Retry', 'Saved'],
  );
  assert.deepEqual(
    queue.map((item) => item.content.variant),
    ['accent', 'danger', 'success'],
  );
  service.dismiss(first);
  assert.ok(!toast.getQueue().visibleToasts.some((item) => item.key === first));
  service.dismiss(second);
  toast.close(native);
  await settings.set(notificationPreferences.fields.placement, 'top end');
  assert.equal(settings.get(notificationPreferences.fields.placement).value, 'top end');
  assert.ok(settings.getSection('shell-notifications'));
  stop();
  assert.equal(runtime.app.optional.services.notifications, undefined);
  assert.throws(() => service.show('Late'), /no longer active/);
  toast.clear();
});

test('developers replace the same public service through the existing lifecycle', () => {
  const messages = [];
  let disposed = 0;
  const implementation = {
    show(message, options) {
      messages.push([message, options]);
      return 'custom';
    },
    dismiss() {},
  };
  const { runtime, settings, stop } = mount({
    toastProvider: false,
    service: {
      create: () => implementation,
      dispose: (service) => {
        assert.equal(service, implementation);
        disposed++;
      },
    },
  });
  assert.equal(runtime.app.services.notifications.show('Custom', { type: 'info' }), 'custom');
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], 'Custom');
  assert.equal(messages[0][1].type, 'info');
  assert.equal(messages[0][1].description, undefined);
  assert.equal(
    settings.getSection('shell-notifications'),
    undefined,
    'native position UI is absent for an external provider',
  );
  stop();
  assert.equal(disposed, 1);
});

test('notifications remain optional and configured native position supplies the reset default', async () => {
  const disabled = mount(false);
  assert.equal(disabled.runtime.app.optional.services.notifications, undefined);
  disabled.stop();
  const { settings, runtime, stop } = mount({ placement: 'top start' });
  const section = settings.getSection('shell-notifications');
  const field = section.fields[0];
  await settings.activate({ userId: 'defaults' });
  assert.equal(settings.get(field).value, 'top start');
  await settings.set(field, 'bottom end');
  await settings.reset(field);
  assert.equal(settings.get(field).value, 'top start');
  assert.ok(runtime.app.services.notifications);
  stop();
});

test('notification boundary translates title and description for replacement renderers', async () => {
  const { translatedNotifications } = await import('../dist/services/notifications.js');
  const { createTranslationPlugin } = await import('@bitakit/core');
  const calls = [];
  const original = { show: (...args) => { calls.push(args); return 7; }, dismiss() {} };
  let disposed;
  const translation = createTranslationPlugin((key, values) => `${key}:${values.name}`);
  const definition = translatedNotifications({ create: () => original, dispose: value => { disposed = value; } });
  const service = definition.create({ services: { i18n: translation.translation }, config: {} });
  assert.equal(service.show('saved', { description: 'details', values: { name: 'Ada' } }), 7);
  assert.equal(calls[0][0], 'saved:Ada');
  assert.equal(calls[0][1].description, 'details:Ada');
  translation.update(key => `new:${key}`);
  service.show('saved');
  assert.equal(calls[1][0], 'new:saved');
  definition.dispose(service);
  assert.equal(disposed, original);
});
