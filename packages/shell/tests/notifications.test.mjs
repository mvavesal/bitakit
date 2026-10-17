import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, settle } from './support.mjs';
import { createElement as h, act } from 'react';
import { toast } from '@heroui/react';
import { FoundationRuntime, createActionList, createMemorySettingsStorage, createTranslationPlugin, defineAction, definePlugin } from '@bitakit/core';
import { FoundationProvider, useFoundation } from '@bitakit/ui';
import { shellPlugin, notificationService, useNotifications } from '../dist/index.js';

const visible = () =>
  toast.getQueue().visibleToasts.map((item) => [item.content.title, item.content.variant]);

test('the service uses the HeroUI queue, translates through i18n and stops with the runtime', async () => {
  toast.clear();
  const translation = createTranslationPlugin((key, values) =>
    key === 'files.saved' ? `Saved ${values?.name}` : key === 'files.details' ? 'Details' : key,
  );
  const runtime = new FoundationRuntime(
    createActionList(),
    { plugins: [translation, shellPlugin()] },
    { 'settings.storage': createMemorySettingsStorage() },
  );
  const stop = runtime.mount();
  await runtime.ready;
  const service = runtime.app.services.notifications;
  assert.equal(service, runtime.app.services.shell.notifications, 'one instance, two names');
  assert.equal(runtime.app.has(notificationService), true);
  const saved = service.show('files.saved', {
    type: 'success',
    duration: 0,
    values: { name: 'Ada' },
  });
  service.show('Plain text', { type: 'error', description: 'files.details', duration: 0 });
  const native = toast.info('Native source', { timeout: 0 });
  assert.deepEqual(visible(), [
    ['Native source', 'accent'],
    ['Plain text', 'danger'],
    ['Saved Ada', 'success'],
  ]);
  assert.equal(
    toast.getQueue().visibleToasts.find((item) => item.content.title === 'Plain text').content
      .description,
    'Details',
  );
  service.dismiss(saved);
  assert.ok(!toast.getQueue().visibleToasts.some((item) => item.key === saved));
  toast.close(native);
  await stop();
  assert.equal(runtime.app.has('notifications'), false);
  assert.throws(() => service.show('Late'), /no longer active/);
  toast.clear();
});

test('one toast region shows action feedback and native toasts at the placement setting', async () => {
  toast.clear();
  const files = definePlugin({
    id: 'files',
    actions: {
      upload: defineAction({
        title: 'Upload',
        failure: 'Upload failed',
        execute() {
          throw new Error('offline');
        },
      }),
      save: defineAction({ title: 'Save', success: 'Saved', execute() {} }),
    },
  });
  const config = { plugins: [shellPlugin(), files] };
  const services = {
    'settings.storage': createMemorySettingsStorage({ 'shell.toasts': 'top start' }),
  };
  let runtime;
  let notifications;
  function Probe() {
    runtime = useFoundation().runtime;
    notifications = useNotifications();
    return null;
  }
  const view = await mount(h(FoundationProvider, { config, services }, h(Probe)));
  try {
    await settle();
    assert.equal(notifications, runtime.app.services.notifications, 'useNotifications');
    await act(async () => {
      await runtime.actions.execute('files.upload').catch(() => {});
      await runtime.actions.execute('files.save');
      toast.info('Native source', { timeout: 0 });
    });
    assert.equal(document.querySelectorAll('[data-slot="toast-region"]').length, 1);
    assert.deepEqual(visible(), [
      ['Native source', 'accent'],
      ['Saved', 'success'],
      ['Upload failed', 'danger'],
    ]);
    const region = document.querySelector('[data-slot="toast-region"]');
    assert.match(region.textContent, /Upload failed/);
    assert.match(region.textContent, /Native source/);
    assert.ok(region.classList.contains('toast-region--top-start'), region.className);
    await act(() => runtime.settings.set('shell.toasts', 'bottom end'));
    const moved = document.querySelector('[data-slot="toast-region"]');
    assert.ok(moved.classList.contains('toast-region--bottom-end'), moved.className);
    assert.ok(
      [...document.querySelectorAll('[data-slot="toast"]')].every(
        (item) => item.getAttribute('data-placement') === 'bottom end',
      ),
    );
  } finally {
    await act(async () => toast.clear());
    await view.unmount();
  }
  runtime.notify('After unmount', 'failure');
  assert.deepEqual(visible(), [], 'unmounting removes the notifier');
  assert.equal(document.querySelectorAll('[data-slot="toast-region"]').length, 0);
});
