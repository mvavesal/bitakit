import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:3103';
const env = parseEnv(await readFile(new URL('.env.local', import.meta.url), 'utf8'));
const browser = await chromium.launch();
const context = await browser.newContext();
const request = context.request;
const organizations = [];
async function post(path, data) {
  const response = await request.post(origin + path, { headers: { origin }, data });
  assert.equal(response.ok(), true, `${path}: ${response.status()}`);
  return response.json();
}
try {
  await post('/api/auth/sign-in/email', { email: 'alice@example.test', password: env.TODO_PREVIEW_PASSWORD });
  for (const letter of ['A', 'B']) {
    const name = `Clear check ${letter} ${Date.now()}`;
    const organization = await post('/api/auth/organization/create', { name, slug: name.toLowerCase().replaceAll(' ', '-') });
    organizations.push(organization.id);
    await post('/api/auth/organization/set-active', { organizationId: organization.id });
    await post('/api/tasks', { operation: 'add', title: `Disposable task ${letter}` });
  }
  const page = await context.newPage();
  await page.goto(origin + '/todos');
  await page.getByText('Disposable task B', { exact: true }).waitFor();
  const pageClear = page.getByRole('main').getByRole('button', { name: 'Clear all', exact: true });
  const sidebarClear = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Clear all', exact: true });
  assert.equal(await pageClear.isEnabled(), true);
  assert.equal(await sidebarClear.isEnabled(), true);
  await sidebarClear.click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByText('Disposable task B', { exact: true }).waitFor();
  await pageClear.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByText('No tasks yet.', { exact: true }).waitFor();
  assert.equal(await pageClear.isDisabled(), true);
  assert.equal(await sidebarClear.isDisabled(), true);
  await page.reload();
  await page.getByText('No tasks yet.', { exact: true }).waitFor();
  await post('/api/auth/organization/set-active', { organizationId: organizations[0] });
  const retained = await request.get(origin + '/api/tasks').then((response) => response.json());
  assert.equal(retained.items.length, 1);
  assert.equal(retained.items[0].title, 'Disposable task A');
  await page.reload();
  await page.getByText('Disposable task A', { exact: true }).waitFor();
  await post('/api/auth/organization/set-active', { organizationId: organizations[1] });
  await post('/api/tasks', { operation: 'add', title: 'Preserve B during confirmation' });
  await post('/api/auth/organization/set-active', { organizationId: organizations[0] });
  await sidebarClear.click();
  // Another tab can change the server session while the confirmation is open.
  await post('/api/auth/organization/set-active', { organizationId: organizations[1] });
  const refreshed = page.waitForResponse((response) => response.url().endsWith('/api/auth/get-session'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refreshed;
  await page.getByText('Preserve B during confirmation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('region', { name: 'notification.' }).getByText('The account or organization changed. Confirm again to clear its tasks.', { exact: true }).waitFor();
  const preserved = await request.get(origin + '/api/tasks').then((response) => response.json());
  assert.equal(preserved.items.length, 1);
  await post('/api/auth/organization/set-active', { organizationId: organizations[0] });
  const stale = await request.post(origin + '/api/tasks', {
    data: { operation: 'clear', organizationId: organizations[1] },
  });
  assert.equal(stale.status(), 409);
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.post(origin + '/api/tasks', {
    data: { operation: 'clear', organizationId: organizations[0] },
  })).status(), 401);
  await anonymous.close();
  console.log('Clear passed in page and sidebar: enabled with tasks, disabled when empty, cancel preserves, confirm clears and reload stays empty, other organization preserved, switching organization during confirmation blocked, stale scope and anonymous calls rejected.');
} finally {
  for (const organizationId of organizations) await request.post(origin + '/api/auth/organization/delete', { headers: { origin }, data: { organizationId } });
  await browser.close();
}
