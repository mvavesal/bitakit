import { test, expect } from '@playwright/test';
import { settingsAccess } from '../src/settings/server/access';

test('direct organization settings do not grant an anonymous visitor domain access', async ({
  page,
  request,
}) => {
  await page.goto('/settings/organization');
  await expect(page.getByText('Choose an organization', { exact: true })).toBeVisible();
  const response = await request.get('/api/organizations/active');
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: 'unauthorized' });
});

test('settings ownership comes from verified identity and organization membership', () => {
  expect(() => settingsAccess('user', undefined, undefined, undefined)).toThrow('Sign in');
  expect(settingsAccess('user', 'alice', 'other-org', undefined)).toMatchObject({
    owner: 'alice',
    userId: 'alice',
    organizationId: null,
  });
  expect(() => settingsAccess('organization', 'outsider', 'org', undefined)).toThrow('denied');
  expect(settingsAccess('organization', 'member', 'org', 'member').writable).toBe(false);
  expect(settingsAccess('organization', 'admin', 'org', 'admin').writable).toBe(true);
  expect(settingsAccess('organization', 'owner', 'org', 'owner').writable).toBe(true);
  expect(settingsAccess('global', 'org-owner', 'org', 'owner').writable).toBe(false);
  expect(settingsAccess('global', 'explicit-app-admin', undefined, undefined, true).writable).toBe(
    true,
  );
});
