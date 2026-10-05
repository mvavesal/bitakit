import test from 'node:test';
import assert from 'node:assert/strict';
import {
  organizationBackend,
  organizationsPlugin,
  organizationService,
} from '@bitakit/organizations';
import { createDemoOrganizationBackend } from '@bitakit/organizations/demo';
import { organizationUIPlugin } from '../dist/organizations.js';
import { createActionList, FoundationRuntime, getService } from '@bitakit/core';
import BuildingIcon from 'reicon-react/icons/Building';

test('UI uses the registered service and cleanup removes its navigation and commands', async () => {
  const actions = createActionList();
  const ui = organizationUIPlugin();
  const runtime = new FoundationRuntime(
    actions,
    { plugins: [organizationsPlugin(), ui] },
    { [organizationBackend]: createDemoOrganizationBackend() },
  );
  const stop = runtime.mount();
  const service = getService(runtime.services, organizationService);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(actions.get('organizations.open').href, '/organizations');
  await service.setActive('academy');
  assert.equal(service.getSnapshot().activeId, 'academy');
  await stop();
  assert.equal(actions.get('organizations.open'), undefined);
  await assert.rejects(service.refresh(), /disposed/);
});

test('organization settings separate profile, members and personal invitations while preserving action guards', async () => {
  const actions = createActionList();
  const plugin = organizationUIPlugin();
  assert.deepEqual(plugin.settings.settings, {});
  assert.equal(plugin.settings.section.title, 'Organization profile');
  assert.equal(plugin.settings.section.category, 'organization');
  assert.equal(plugin.settings.section.order, 10);
  assert.equal(plugin.settings.section.path, 'organization');
  assert.equal(plugin.settings.section.icon, BuildingIcon);
  assert.equal(typeof plugin.ui.settings.component, 'function');
  assert.deepEqual(plugin.ui.settings.pages.map(({ id, path, category }) => ({ id, path, category })), [
    { id: 'members', path: 'organization/members', category: 'organization' },
    { id: 'invitations', path: 'account/invitations', category: 'account' },
  ]);
  assert.deepEqual(
    plugin.ui.pages.map((page) => page.path),
    ['/organizations'],
  );
  for (const legacy of ['pages', 'providers', 'views'])
    assert.equal(plugin[legacy], undefined, legacy);
  const runtime = new FoundationRuntime(
    actions,
    { plugins: [organizationsPlugin(), plugin] },
    { [organizationBackend]: createDemoOrganizationBackend() },
  );
  const stop = runtime.mount();
  // The settings section carries path and shortcut; App Preferences projects the navigation action.
  assert.equal(plugin.settings.section.path, 'organization');
  assert.equal(plugin.settings.section.shortcut, 'Alt+Shift+O');
  assert.equal(actions.get('organizations.settings'), undefined);
  // Role-dependent actions follow the service without a manual subscription.
  const service = getService(runtime.services, organizationService);
  await service.refresh();
  const input = { organizationId: 'studio', memberId: 'studio-member' };
  assert.equal(actions.resolve('organizations.remove', input).visible, true);
  assert.equal(actions.resolve('organizations.promote', input).visible, true);
  assert.equal(actions.resolve('organizations.demote', input).visible, false);
  await service.accept('demo-incoming');
  await service.setActive('partner');
  // The viewer is a plain member of the partner organization: no member management.
  const partner = { organizationId: 'partner', memberId: 'partner-member' };
  assert.equal(service.getSnapshot().canManage, false);
  assert.equal(actions.resolve('organizations.remove', partner).visible, false);
  assert.equal(actions.resolve('organizations.promote', partner).visible, false);
  await stop();
  assert.equal(actions.get('organizations.create'), undefined);
});

test('settings-only organization integration omits its standalone page and navigation', async () => {
  const actions = createActionList();
  const plugin = organizationUIPlugin({ path: false });
  assert.deepEqual(plugin.ui.pages, []);
  assert.equal(typeof plugin.ui.settings.component, 'function');
  const runtime = new FoundationRuntime(
    actions,
    { plugins: [organizationsPlugin(), plugin] },
    { [organizationBackend]: createDemoOrganizationBackend() },
  );
  const stop = runtime.mount();
  try {
    assert.equal(actions.get('organizations.open'), undefined);
    assert.ok(actions.get('organizations.create'));
  } finally {
    await stop();
  }
});
