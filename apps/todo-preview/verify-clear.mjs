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
/** Calls a server operation like the browser does: POST /api/rpc/<id>, answered `{ data }`. */
async function rpc(id, input) {
  const response = await request.post(`${origin}/api/rpc/${id}`, {
    headers: { origin, 'content-type': 'application/json' },
    ...(input === undefined ? {} : { data: input }),
  });
  assert.equal(response.ok(), true, `${id}: ${response.status()}`);
  return (await response.json()).data;
}
try {
  await post('/api/auth/sign-in/email', {
    email: 'alice@example.test',
    password: env.TODO_PREVIEW_PASSWORD,
  });
  for (const letter of ['A', 'B']) {
    const name = `Clear check ${letter} ${Date.now()}`;
    const organization = await post('/api/auth/organization/create', {
      name,
      slug: name.toLowerCase().replaceAll(' ', '-'),
    });
    organizations.push(organization.id);
    await post('/api/auth/organization/set-active', { organizationId: organization.id });
    await rpc('todos.add', { title: `Disposable task ${letter}` });
  }
  const page = await context.newPage();
  await page.goto(origin + '/todos');
  await page.getByText('Disposable task B', { exact: true }).waitFor();
  const pageClear = page.getByRole('main').getByRole('button', { name: 'Clear all', exact: true });
  assert.equal(await pageClear.isEnabled(), true);
  await pageClear.click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByText('Disposable task B', { exact: true }).waitFor();
  await pageClear.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByText('No tasks yet.', { exact: true }).waitFor();
  assert.equal(await pageClear.isDisabled(), true);
  await page.reload();
  await page.getByText('No tasks yet.', { exact: true }).waitFor();
  await post('/api/auth/organization/set-active', { organizationId: organizations[0] });
  const retained = await rpc('todos.list');
  assert.equal(retained.items.length, 1);
  assert.equal(retained.items[0].title, 'Disposable task A');
  await page.reload();
  await page.getByText('Disposable task A', { exact: true }).waitFor();
  await post('/api/auth/organization/set-active', { organizationId: organizations[1] });
  await rpc('todos.add', { title: 'Preserve B during confirmation' });
  await post('/api/auth/organization/set-active', { organizationId: organizations[0] });
  await pageClear.click();
  // Another tab can change the server session while the confirmation is open.
  await post('/api/auth/organization/set-active', { organizationId: organizations[1] });
  const refreshed = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/get-session'),
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refreshed;
  await page.getByText('Preserve B during confirmation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page
    .getByRole('region', { name: 'notification.' })
    .getByText('The account or organization changed. Confirm again to clear its tasks.', {
      exact: true,
    })
    .waitFor();
  const preserved = await rpc('todos.list');
  assert.equal(preserved.items.length, 1);
  await post('/api/auth/organization/set-active', { organizationId: organizations[0] });
  // Without Origin, as a non-browser client: the confirmed organization is not the session's.
  const stale = await request.post(origin + '/api/rpc/todos.clear', {
    data: { organizationId: organizations[1] },
  });
  assert.equal(stale.status(), 409);
  assert.equal((await stale.json()).error.code, 'CONFLICT');
  // The organization header the browser's remote sends: the page's organization is not the session's.
  const moved = await request.post(origin + '/api/rpc/todos.clear', {
    headers: { 'x-bitakit-organization': organizations[1] },
    data: { organizationId: organizations[1] },
  });
  assert.equal(moved.status(), 409);
  assert.equal((await moved.json()).error.reason, 'ORGANIZATION_CHANGED');
  assert.equal((await rpc('todos.list')).items.length, 1);
  const anonymous = await browser.newContext();
  const refused = await anonymous.request.post(origin + '/api/rpc/todos.clear', {
    data: { organizationId: organizations[0] },
  });
  assert.equal(refused.status(), 401);
  assert.equal((await refused.json()).error.code, 'UNAUTHORIZED');
  await anonymous.close();
  console.log(
    'Clear passed: enabled with tasks, disabled when empty, cancel preserves, confirm clears and reload stays empty, other organization preserved, switching organization during confirmation blocked, stale scope and anonymous calls rejected.',
  );
} finally {
  for (const organizationId of organizations)
    await request.post(origin + '/api/auth/organization/delete', {
      headers: { origin },
      data: { organizationId },
    });
  await browser.close();
}
