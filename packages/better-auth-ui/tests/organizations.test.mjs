import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationsPlugin, organizationService } from '@bitakit/organizations';
import { createDemoOrganizationBackend } from '@bitakit/organizations/demo';
import { organizationUIPlugin } from '../dist/organizations.js';
import { createActionList, FoundationRuntime, getService } from '@bitakit/core';

test('UI uses the registered service and cleanup removes its navigation and commands', async () => {
  const actions = createActionList();
  const ui = organizationUIPlugin();
  const runtime = new FoundationRuntime(actions, {
    plugins: [organizationsPlugin(createDemoOrganizationBackend), ui],
  });
  const stop = runtime.mount();
  const service = getService(runtime.services, organizationService);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(actions.get('organizations.open').href, '/organizations');
  await service.setActive('academy');
  assert.equal(service.getSnapshot().activeId, 'academy');
  stop();
  assert.equal(actions.get('organizations.open'), undefined);
  await assert.rejects(service.refresh(), /disposed/);
});

test('member settings navigation follows organization role and cleans up on unmount', async () => {
  const { AppPreferences } = await import('@bitakit/app-preferences/core');
  const settings = new AppPreferences({ read: async () => null, write: async () => {} });
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [organizationsPlugin(createDemoOrganizationBackend), organizationUIPlugin({ settings })],
  });
  const stop = runtime.mount();
  const service = getService(runtime.services, organizationService);
  assert.equal(settings.getSection('organization-members').visible, false);
  await service.refresh();
  assert.equal(settings.getSection('organization-members').visible, true);
  await service.accept('demo-incoming');
  await service.setActive('partner');
  assert.equal(settings.getSection('organization-members').visible, false);
  assert.equal(settings.getSection('organization').visible, true);
  assert.equal(settings.getSection('received-invitations').visible, true);
  await service.setActive('studio');
  assert.equal(settings.getSection('organization-members').visible, true);
  stop();
  assert.equal(settings.getSection('organization-members'), undefined);
});

test('settings-only organization integration omits its standalone page and navigation', () => {
  const actions = createActionList();
  const plugin = organizationUIPlugin({ path: false });
  assert.ok(plugin.pages.length > 0);
  assert.ok(plugin.pages.every((page) => page.path.startsWith('/settings/')));
  const runtime = new FoundationRuntime(actions, {
    plugins: [organizationsPlugin(createDemoOrganizationBackend), plugin],
  });
  const stop = runtime.mount();
  try {
    assert.equal(actions.get('organizations.open'), undefined);
    assert.ok(actions.get('organizations.create'));
  } finally {
    stop();
  }
});
