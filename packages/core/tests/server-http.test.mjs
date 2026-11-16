import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { defineAction, fetchHandler } from '../dist/server/index.js';
import { provider, quiet, serverOf } from './server-fixtures.mjs';

const origin = 'https://app.example.com';
const post = (path, body, headers = {}, method = 'POST') =>
  new Request(`${origin}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-who': 'member', ...headers },
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });
const read = async (response) => ({
  status: response.status,
  type: response.headers.get('content-type'),
  cache: response.headers.get('cache-control'),
  body: await response.text(),
});

function setup(options) {
  const server = serverOf({
    add: defineAction({
      access: 'organization',
      expose: true,
      input: z.object({ title: z.string().min(1) }),
      output: z.object({ id: z.string(), title: z.string() }),
      execute: ({ input, ctx }) => ({
        id: `${ctx.organization.id}-1`,
        title: input.title,
        internal: true,
      }),
    }),
    clear: defineAction({ access: 'organization', expose: true, execute: () => undefined }),
    secret: defineAction({ access: 'public', execute: () => 'private' }),
  });
  return { server, handle: fetchHandler(server, options) };
}

test('POST <endpoint>/<id> answers { data } or { error } as uncached JSON', async () => {
  const { server, handle } = setup();
  try {
    const added = await read(await handle(post('/api/rpc/todos.add', '{"title":"Milk"}')));
    assert.deepEqual(added, {
      status: 200,
      type: 'application/json',
      cache: 'no-store',
      body: '{"data":{"id":"o1-1","title":"Milk"}}',
    });
    assert.equal((await read(await handle(post('/api/rpc/todos.clear', '')))).body, '{}');
    const invalid = await read(await handle(post('/api/rpc/todos.add', '{"title":""}')));
    assert.equal(invalid.status, 400);
    assert.equal(invalid.cache, 'no-store');
    assert.deepEqual(JSON.parse(invalid.body).error.issues[0].path, ['title']);
    const anonymous = await handle(
      post('/api/rpc/todos.add', '{"title":"x"}', { 'x-who': 'anonymous' }),
    );
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), {
      error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' },
    });
    const stale = await handle(
      post('/api/rpc/todos.clear', '', { 'x-bitakit-organization': 'o2' }),
    );
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.reason, 'ORGANIZATION_CHANGED');
    const noBody = await handle(post('/api/rpc/todos.clear', '{"all":true}'));
    assert.equal(noBody.status, 400);
  } finally {
    await server.stop();
  }
});

test('unknown, private, case-variant, encoded and malformed IDs get byte-identical 404s', async () => {
  const { server, handle } = setup();
  try {
    const bodies = new Set();
    for (const path of [
      '/api/rpc/todos.missing',
      '/api/rpc/todos.secret',
      '/api/rpc/TODOS.ADD',
      '/api/rpc/todos%2Eadd',
      '/api/rpc/todos.add/extra',
      '/api/rpc/',
      '/api/rpc/-x',
      '/elsewhere/todos.add',
    ]) {
      const response = await read(await handle(post(path, '{"title":"x"}')));
      assert.equal(response.status, 404, path);
      bodies.add(response.body);
    }
    assert.deepEqual(
      [...bodies],
      ['{"error":{"code":"NOT_FOUND","message":"Operation not found."}}'],
    );
    // Private operations stay callable in-process.
    assert.equal(await server.as(new Headers()).todos.secret(), 'private');
  } finally {
    await server.stop();
  }
});

test('method, content type essence, Origin, Sec-Fetch-Site, size and JSON are checked before the call', async () => {
  const { server, handle } = setup({
    trustedOrigins: ['https://admin.example.com'],
    maxBodyBytes: 64,
  });
  try {
    const status = async (request) => (await handle(request)).status;
    const get = await handle(post('/api/rpc/todos.add', undefined, {}, 'GET'));
    assert.equal(get.status, 405);
    assert.equal(get.headers.get('allow'), 'POST');
    assert.equal((await get.json()).error.code, 'METHOD_NOT_SUPPORTED');
    for (const type of ['text/plain', 'text/plain; x=application/json', 'application/jsonx', ''])
      assert.equal(
        await status(post('/api/rpc/todos.clear', '', { 'content-type': type })),
        415,
        type,
      );
    assert.equal(
      await status(
        post('/api/rpc/todos.clear', '', { 'content-type': 'Application/JSON; charset=utf-8' }),
      ),
      200,
    );
    for (const [headers, expected] of [
      [{ origin }, 200],
      [{ origin: 'https://admin.example.com' }, 200],
      [{ origin: 'https://evil.example.com' }, 403],
      [{ origin: 'null' }, 403],
      [{ 'sec-fetch-site': 'cross-site' }, 403],
      [{ 'sec-fetch-site': 'same-site' }, 403],
      [{ 'sec-fetch-site': 'same-origin' }, 200],
      [{ 'sec-fetch-site': 'none' }, 200],
      [{}, 200],
    ])
      assert.equal(
        await status(post('/api/rpc/todos.clear', '', headers)),
        expected,
        JSON.stringify(headers),
      );
    const large = JSON.stringify({ title: 'x'.repeat(100) });
    assert.equal(await status(post('/api/rpc/todos.add', large)), 413);
    // A lying content-length still stops at the limit while reading.
    const streamed = new Request(`${origin}/api/rpc/todos.add`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-who': 'member' },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(large));
          controller.close();
        },
      }),
      duplex: 'half',
    });
    assert.equal(await status(streamed), 413);
    const malformed = await handle(post('/api/rpc/todos.add', '{"title":'));
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: { code: 'BAD_REQUEST', message: 'Invalid JSON.' },
    });
  } finally {
    await server.stop();
  }
});

test('same-origin browser calls pass when the host hands the handler another URL (Next.js: localhost for 127.0.0.1)', async () => {
  const { server, handle } = setup();
  try {
    const local = (headers) =>
      new Request('http://localhost:3103/api/rpc/todos.clear', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-who': 'member', ...headers },
      });
    const page = 'http://127.0.0.1:3103';
    for (const [headers, expected] of [
      [{ origin: page, host: '127.0.0.1:3103' }, 200],
      [{ origin: page, 'sec-fetch-site': 'same-origin' }, 200],
      [{ origin: page }, 403],
      [{ origin: 'https://evil.example.com', host: '127.0.0.1:3103' }, 403],
      [
        {
          origin: 'https://evil.example.com',
          host: '127.0.0.1:3103',
          'sec-fetch-site': 'cross-site',
        },
        403,
      ],
      [{ origin: 'null', host: '127.0.0.1:3103' }, 403],
    ])
      assert.equal((await handle(local(headers))).status, expected, JSON.stringify(headers));
  } finally {
    await server.stop();
  }
});

test('the public origin option replaces the request origin behind a proxy; bad origins throw at creation', async () => {
  const { server, handle } = setup({ origin: 'https://public.example.com' });
  try {
    const internal = (headers) =>
      new Request('http://10.0.0.5:3000/api/rpc/todos.clear', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-who': 'member', ...headers },
      });
    assert.equal((await handle(internal({ origin: 'https://public.example.com' }))).status, 200);
    assert.equal((await handle(internal({ origin: 'http://10.0.0.5:3000' }))).status, 403);
  } finally {
    await server.stop();
  }
  for (const trustedOrigins of [
    ['*'],
    ['https://*.example.com'],
    ['null'],
    ['https://a.com/path'],
    ['nope'],
  ])
    assert.throws(() => fetchHandler(server, { trustedOrigins }), /not an exact origin/);
  assert.throws(() => fetchHandler(server, { origin: 'https://a.com/' }), /not an exact origin/);
});

test('maxBodyBytes is a whole number of bytes: NaN or Infinity never turn the limit off', async () => {
  const { server, handle } = setup({ maxBodyBytes: 0 });
  try {
    for (const maxBodyBytes of [NaN, Number(undefined), Infinity, -1, 1.5, '1024'])
      assert.throws(
        () => fetchHandler(server, { maxBodyBytes }),
        /maxBodyBytes .* is not a whole number of bytes/,
        String(maxBodyBytes),
      );
    // 0 admits only an empty body.
    assert.equal((await handle(post('/api/rpc/todos.clear', ''))).status, 200);
    assert.equal((await handle(post('/api/rpc/todos.add', '{"title":"x"}'))).status, 413);
  } finally {
    await server.stop();
  }
});

test('a custom endpoint is the one prefix; failures never leak internals', async () => {
  const server = serverOf(
    {
      boom: defineAction({
        access: 'public',
        expose: true,
        execute: () => {
          throw new Error('connection string postgres://user:pw@db');
        },
      }),
      big: defineAction({ access: 'public', expose: true, execute: () => 10n }),
    },
    { services: { requestContext: provider() }, options: { endpoint: '/rpc/' } },
  );
  const handle = fetchHandler(server);
  try {
    assert.equal(server.endpoint, '/rpc');
    assert.equal((await handle(post('/api/rpc/todos.boom', ''))).status, 404);
    await quiet('error', async () => {
      for (const name of ['boom', 'big']) {
        const response = await handle(post(`/rpc/todos.${name}`, ''));
        assert.equal(response.status, 500);
        const { error } = await response.json();
        assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
        assert.match(error.message, /^Something went wrong\. Reference: /);
        assert.equal(Object.keys(error).sort().join(), 'code,message,requestId');
      }
    });
  } finally {
    await server.stop();
  }
});
