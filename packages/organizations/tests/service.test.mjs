import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrganizationService,
  organizationBackend,
  organizationsPlugin,
  organizationService,
} from '../dist/index.js';
import { createDemoOrganizationBackend } from '../dist/demo.js';
import { createRuntime, getService } from '@bitakit/core';

test('organization switching isolates invitations, validates roles and protects owners', async () => {
  const service = createOrganizationService(createDemoOrganizationBackend());
  await service.refresh();
  await service.invite(' Person@Example.test ');
  assert.equal(service.getSnapshot().invitations[0].email, 'person@example.test');
  assert.throws(() => service.updateRole('studio-owner', 'member'), /not available/);
  assert.throws(() => service.invite('x@example.test', 'owner'), /Invalid role/);
  await service.setActive('academy');
  assert.equal(service.getSnapshot().invitations.length, 0);
  await service.setActive('studio');
  const invite = service.getSnapshot().invitations[0];
  await service.resend(invite.id);
  assert.equal(service.getSnapshot().invitations.length, 1);
  await service.cancel(invite.id);
  assert.equal(service.getSnapshot().invitations.length, 0);
  service.dispose();
  await assert.rejects(service.refresh(), /disposed/);
});

test('stale loads and disposed responses cannot restore old organization data', async () => {
  const pending = [];
  const service = createOrganizationService({
    load: () => new Promise((resolve) => pending.push(resolve)),
  });
  const first = service.refresh();
  const second = service.refresh();
  const data = (id) => ({
    organizations: [],
    activeId: id,
    members: [],
    invitations: [],
    canManage: false,
  });
  pending[1](data('new'));
  await second;
  pending[0](data('old'));
  await first;
  assert.equal(service.getSnapshot().activeId, 'new');
  const third = service.refresh();
  service.dispose();
  pending[2](data('after'));
  await third;
  assert.equal(service.getSnapshot().activeId, 'new');
});

test('backend context invalidation clears tenant data immediately and unsubscribes on disposal', async () => {
  const backend = createDemoOrganizationBackend();
  let invalidate;
  let unsubscribed = 0;
  backend.subscribe = (listener) => {
    invalidate = listener;
    return () => unsubscribed++;
  };
  const service = createOrganizationService(backend);
  await service.refresh();
  let finish;
  backend.load = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  invalidate();
  assert.equal(service.getSnapshot().activeId, null);
  assert.equal(service.getSnapshot().canManage, false);
  service.dispose();
  finish({ organizations: [], activeId: 'late', members: [], invitations: [], canManage: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(service.getSnapshot().activeId, null);
  assert.equal(unsubscribed, 1);
});

test('suspension protects owners and recipient invitation acceptance changes membership', async () => {
  const service = createOrganizationService(createDemoOrganizationBackend());
  await service.refresh();
  assert.throws(() => service.setDisabled('studio-owner', true), /not available/);
  await service.setDisabled('studio-member', true);
  assert.equal(service.getSnapshot().members.find((x) => x.id === 'studio-member').disabled, true);
  await service.setDisabled('studio-member', false);
  assert.equal(service.getSnapshot().members.find((x) => x.id === 'studio-member').disabled, false);
  await service.accept('demo-incoming');
  assert.equal(service.getSnapshot().incomingInvitations.length, 0);
  await service.setActive('partner');
  assert.equal(service.getSnapshot().canManage, false);
  assert.throws(() => service.invite('a@example.test'), /not available/);
  service.dispose();
});

test('website validation blocks invalid create and update before backend writes', async () => {
  const { isOrganizationWebsite } = await import('../dist/index.js');
  const invalid = [
    'garbage',
    'https://',
    'https:///example.com',
    'https://bad',
    'https://www.mva',
    'https://www',
    'https://com',
    'https://bad..example',
    'https://-bad.example',
    'https://example.com/a b',
    'https://user:secret@example.com',
    'javascript:alert(1)',
    'https://example.com:99999',
    'https://example.com\\bad',
  ];
  const service = createOrganizationService(createDemoOrganizationBackend());
  await service.refresh();
  for (const website of invalid) {
    assert.equal(isOrganizationWebsite(website), false, website);
    assert.throws(
      () => service.create({ name: 'Invalid', slug: 'invalid', website }),
      /Invalid URL/,
    );
    assert.throws(
      () => service.update({ name: 'Invalid', slug: 'invalid', website }),
      /Invalid URL/,
    );
  }
  for (const website of [
    '',
    'https://example.com/path?q=1#section',
    'http://localhost:3102',
    'https://bücher.de',
    'https://127.0.0.1',
    'https://[::1]',
  ])
    assert.equal(isOrganizationWebsite(website), true, website);
  await service.create({ name: 'Valid', slug: 'valid', website: ' https://example.com ' });
  assert.equal(
    service.getSnapshot().organizations.find((org) => org.slug === 'valid').website,
    'https://example.com',
  );
  service.dispose();
});

test('the plugin reads its backend from the organization-backend contract', async () => {
  assert.equal(organizationBackend, 'organization-backend');
  assert.throws(
    () => createRuntime({ plugins: [organizationsPlugin()] }).mount(),
    /requires service "organization-backend"/,
  );
  const runtime = createRuntime(
    { plugins: [organizationsPlugin()] },
    { services: { [organizationBackend]: createDemoOrganizationBackend() } },
  );
  const stop = runtime.mount();
  try {
    const service = getService(runtime.services, organizationService);
    await service.refresh();
    assert.ok(service.getSnapshot().organizations.length > 0);
  } finally {
    stop();
  }
});
