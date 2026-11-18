import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createServer,
  defineAction,
  definePlugin,
  defineService,
  fetchHandler,
  requestContext,
} from '../dist/server/index.js';

// 2026-11-18: CORS for trusted origins, rate limits for public operations over HTTP, and a system
// principal for jobs and webhooks. `resolved` counts the requestContext provider's calls.
function app(options = {}) {
  const resolved = [];
  const ping = defineAction({ access: 'public', expose: true, execute: () => 'pong' });
  const mine = defineAction({ access: 'user', expose: true, execute: ({ ctx }) => ctx.user.id });
  const invoice = defineAction({
    access: { permission: { invoices: ['write'] } },
    execute: ({ ctx }) => ({
      user: ctx.user,
      organization: ctx.organization.id,
      member: ctx.member,
    }),
  });
  const purge = defineAction({
    access: { permission: { invoices: ['delete'] } },
    execute: () => 'gone',
  });
  const members = defineAction({
    access: 'organization',
    execute: ({ ctx }) => ctx.organization.id,
  });
  const identity = defineService(
    () => ({
      resolve: (request) => {
        resolved.push(request.url);
        const user = request.headers.get('x-user');
        return user ? { user: { id: user } } : { user: null };
      },
    }),
    { provides: requestContext },
  );
  const server = createServer(
    {
      plugins: [
        definePlugin({
          id: 'billing',
          actions: { ping, mine, invoice, purge, members },
          services: { identity },
        }),
      ],
    },
    options,
  );
  return { server, resolved };
}
const at = (path, init = {}) =>
  new Request(`http://app.test/api/rpc/${path}`, { method: 'POST', ...init });
const json = { 'content-type': 'application/json' };

test('CORS: only trusted origins get a preflight answer and CORS headers; never *', async () => {
  const { server } = app();
  const handle = fetchHandler(server, { trustedOrigins: ['https://admin.example'] });
  try {
    const preflight = await handle(
      at('billing.ping', {
        method: 'OPTIONS',
        headers: { origin: 'https://admin.example', 'access-control-request-method': 'POST' },
      }),
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://admin.example');
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
    assert.match(preflight.headers.get('access-control-allow-headers'), /content-type/);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(preflight.headers.get('vary'), 'Origin');

    const fromAdmin = await handle(
      at('billing.ping', {
        headers: { ...json, origin: 'https://admin.example', 'sec-fetch-site': 'cross-site' },
      }),
    );
    assert.equal(fromAdmin.status, 200);
    assert.equal(fromAdmin.headers.get('access-control-allow-origin'), 'https://admin.example');

    const foreignPreflight = await handle(
      at('billing.ping', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
    );
    assert.equal(foreignPreflight.status, 403);
    assert.equal(foreignPreflight.headers.get('access-control-allow-origin'), null);
    const foreign = await handle(
      at('billing.ping', {
        headers: { ...json, origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      }),
    );
    assert.equal(foreign.status, 403);
    assert.equal(foreign.headers.get('access-control-allow-origin'), null);

    // Same origin needs no CORS; OPTIONS without an Origin is no preflight.
    const own = await handle(
      at('billing.ping', {
        headers: { ...json, origin: 'http://app.test', 'sec-fetch-site': 'same-origin' },
      }),
    );
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('access-control-allow-origin'), null);
    const options = await handle(at('billing.ping', { method: 'OPTIONS' }));
    assert.equal(options.status, 405);
  } finally {
    await server.stop();
  }
});

test('rate limits: public operations over HTTP per client, 429 with Retry-After; nothing else counts', async () => {
  const hits = [];
  const memory = new Map();
  const store = {
    hit(key, windowMs) {
      hits.push(key);
      const count = (memory.get(key) ?? 0) + 1;
      memory.set(key, count);
      return { count, resetAt: Date.now() + windowMs };
    },
  };
  const { server } = app({ rateLimit: { limit: 2, windowMs: 30_000, store } });
  const handle = fetchHandler(server);
  const from = (ip, path = 'billing.ping', extra = {}) =>
    handle(at(path, { headers: { ...json, 'x-forwarded-for': `${ip}, 10.0.0.1`, ...extra } }));
  try {
    assert.equal((await from('1.1.1.1')).status, 200);
    assert.equal((await from('1.1.1.1')).status, 200);
    const refused = await from('1.1.1.1');
    assert.equal(refused.status, 429);
    assert.equal(refused.headers.get('retry-after'), '30');
    assert.deepEqual((await refused.json()).error, {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Try again later.',
      retryAfter: 30,
    });
    assert.equal((await from('2.2.2.2')).status, 200, 'another client has its own window');
    // Signed-in callers' operations and in-process calls are never counted.
    assert.equal((await from('1.1.1.1', 'billing.mine', { 'x-user': 'u1' })).status, 200);
    assert.equal(await server.as(new Headers()).billing.ping(), 'pong');
    assert.deepEqual(hits, [
      'billing.ping\u00001.1.1.1',
      'billing.ping\u00001.1.1.1',
      'billing.ping\u00001.1.1.1',
      'billing.ping\u00002.2.2.2',
    ]);
  } finally {
    await server.stop();
  }
  const unlimited = app({ rateLimit: false }).server;
  try {
    const open = fetchHandler(unlimited);
    for (let index = 0; index < 150; index++)
      assert.equal((await open(at('billing.ping', { headers: json }))).status, 200);
  } finally {
    await unlimited.stop();
  }
});

test('the system principal: in-process only, its own name, exactly the granted permissions', async () => {
  const { server, resolved } = app();
  try {
    const webhook = server.system('billing.stripe-webhook', {
      organizationId: 'org-1',
      permissions: { invoices: ['write'] },
    });
    const result = await webhook.billing.invoice();
    assert.deepEqual(result.user, {
      id: 'system:billing.stripe-webhook',
      name: 'billing.stripe-webhook',
      system: true,
    });
    assert.equal(result.organization, 'org-1');
    assert.deepEqual(result.member, { role: 'system' });
    assert.equal(await webhook.billing.members(), 'org-1');
    await assert.rejects(webhook.billing.purge(), { code: 'FORBIDDEN', reason: 'PERMISSION' });
    // Without an organization it is a user, never a member anywhere.
    const job = server.system('billing.nightly');
    assert.equal(await job.billing.mine(), 'system:billing.nightly');
    await assert.rejects(job.billing.members(), {
      code: 'FORBIDDEN',
      reason: 'NO_ACTIVE_ORGANIZATION',
    });
    assert.deepEqual(resolved, [], 'the requestContext provider is never asked');
    assert.throws(() => server.system('Billing Webhook'), TypeError);
    assert.throws(() => server.system('billing', { organizationId: '' }), TypeError);
    // No request can become the system: a header claiming it is just another anonymous caller.
    const handle = fetchHandler(server);
    const claimed = await handle(
      at('billing.mine', { headers: { ...json, 'x-bitakit-system': 'billing.stripe-webhook' } }),
    );
    assert.equal(claimed.status, 401);
  } finally {
    await server.stop();
  }
});
