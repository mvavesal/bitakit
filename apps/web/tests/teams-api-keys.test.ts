import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthOptions } from '../src/lib/auth/options';

test('real configured plugins enforce team tenants and personal/organization key ownership', async () => {
  const database = Object.fromEntries(
    [
      'user',
      'session',
      'account',
      'verification',
      'organization',
      'member',
      'invitation',
      'team',
      'teamMember',
      'apikey',
    ].map((k) => [k, []]),
  );
  const auth = betterAuth({
    ...createAuthOptions(),
    baseURL: 'http://localhost:3999',
    secret: 'isolated-server-test-secret-at-least-32-chars',
    database: memoryAdapter(database),
  });
  async function request(path: string, body?: object, cookie = '') {
    const response = await auth.handler(
      new Request('http://localhost:3999/api/auth' + path, {
        method: body ? 'POST' : 'GET',
        headers: { origin: 'http://localhost:3999', 'content-type': 'application/json', cookie },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  const a = await request('/sign-up/email', {
    name: 'Owner A',
    email: 'a@example.test',
    password: 'Test-password123!',
  });
  const b = await request('/sign-up/email', {
    name: 'Owner B',
    email: 'b@example.test',
    password: 'Test-password123!',
  });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const orgA = await request('/organization/create', { name: 'Org A', slug: 'org-a' }, a.cookie);
  const orgB = await request('/organization/create', { name: 'Org B', slug: 'org-b' }, b.cookie);
  const team = await request(
    '/organization/create-team',
    { organizationId: orgA.data.id, name: 'A team' },
    a.cookie,
  );
  assert.equal(team.status, 200);
  assert.equal(
    (
      await request(
        '/organization/add-team-member',
        { teamId: team.data.id, userId: a.data.user.id },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/organization/set-active-team', { teamId: team.data.id }, a.cookie)).status,
    200,
  );
  for (const [path, body] of [
    ['/organization/update-team', { teamId: team.data.id, data: { name: 'Forbidden' } }],
    ['/organization/add-team-member', { teamId: team.data.id, userId: b.data.user.id }],
    ['/organization/remove-team-member', { teamId: team.data.id, userId: a.data.user.id }],
  ] as const)
    assert.ok((await request(path, body, b.cookie)).status >= 400, path);
  assert.equal(
    (
      await request(
        '/organization/remove-team-member',
        { teamId: team.data.id, userId: a.data.user.id },
        a.cookie,
      )
    ).status,
    200,
  );
  for (const configId of ['default', 'organization']) {
    const key = await request(
      '/api-key/create',
      {
        configId,
        name: 'Ephemeral',
        ...(configId === 'organization' ? { organizationId: orgA.data.id } : {}),
      },
      a.cookie,
    );
    assert.equal(key.status, 200);
    assert.ok(
      (
        await request(
          '/api-key/get?configId=' + configId + '&id=' + key.data.id,
          undefined,
          b.cookie,
        )
      ).status >= 400,
    );
    assert.ok(
      (await request('/api-key/delete', { configId, keyId: key.data.id }, b.cookie)).status >= 400,
    );
    assert.equal(
      (await request('/api-key/delete', { configId, keyId: key.data.id }, a.cookie)).status,
      200,
    );
  }
  assert.ok(
    (
      await request(
        '/api-key/create',
        { configId: 'organization', organizationId: orgB.data.id, name: 'Forbidden' },
        a.cookie,
      )
    ).status >= 400,
  );
  assert.equal(database.apikey.length, 0);
});
