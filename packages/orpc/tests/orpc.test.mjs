import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createORPCClient, ORPCError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createServer, defineAction, definePlugin, OperationError } from '@bitakit/core/server';
import { openapiDocument, orpcHandler, orpcRouter } from '../dist/index.js';

// One plugin with a query, a mutation, a failing operation and a private one; `ran` counts every
// execution, so a refused request is proven to run nothing.
function app() {
  const ran = [];
  const titles = ['first'];
  const list = defineAction({
    access: 'public',
    expose: true,
    type: 'query',
    title: 'List todos',
    input: z.object({ q: z.string().default('') }),
    output: z.object({ items: z.array(z.string()) }),
    execute: ({ input }) => {
      ran.push('list');
      return { items: titles.filter((title) => title.includes(input.q)) };
    },
  });
  const add = defineAction({
    access: 'public',
    expose: true,
    input: z.object({ title: z.string().min(1) }),
    execute: ({ input }) => {
      ran.push('add');
      titles.push(input.title);
      return { count: titles.length };
    },
  });
  const fail = defineAction({
    access: 'public',
    expose: true,
    execute: () => {
      ran.push('fail');
      throw new OperationError('CONFLICT', 'Reload first.', { reason: 'STALE' });
    },
  });
  const secret = defineAction({ access: 'public', execute: () => ran.push('secret') });
  const server = createServer({
    plugins: [definePlugin({ id: 'todos', actions: { list, add, fail, secret } })],
  });
  return { server, ran };
}
const base = 'http://app.test';

test('the router holds exposed operations only, nested like their IDs', async () => {
  const { server } = app();
  try {
    const router = await orpcRouter(server);
    assert.deepEqual(Object.keys(router.todos).sort(), ['add', 'fail', 'list']);
  } finally {
    await server.stop();
  }
});

test('RPC: the oRPC client calls operations through server.call; codes and messages map', async () => {
  const { server, ran } = app();
  const handle = orpcHandler(server, { prefix: '/api/orpc' });
  const client = createORPCClient(
    new RPCLink({ url: `${base}/api/orpc`, fetch: (request) => handle(request) }),
  );
  try {
    assert.deepEqual(await client.todos.list({ q: 'fir' }), { items: ['first'] });
    assert.deepEqual(await client.todos.add({ title: 'second' }), { count: 2 });
    // The kernel validates: an empty title never reaches execute.
    await assert.rejects(
      client.todos.add({ title: '' }),
      (error) => error instanceof ORPCError && error.status === 400,
    );
    await assert.rejects(
      client.todos.fail(),
      (error) =>
        error instanceof ORPCError &&
        error.code === 'CONFLICT' &&
        error.status === 409 &&
        error.message === 'Reload first.' &&
        error.data?.reason === 'STALE',
    );
    // A private operation is not part of the router at all.
    await assert.rejects(
      client.todos.secret(),
      (error) => error instanceof ORPCError && error.status === 404,
    );
    assert.deepEqual(ran, ['list', 'add', 'fail']);
  } finally {
    await server.stop();
  }
});

test('OpenAPI: queries answer GET, mutations POST; the same Origin rule as fetchHandler', async () => {
  const { server, ran } = app();
  const handle = orpcHandler(server, { prefix: '/api', protocol: 'openapi' });
  try {
    const listed = await handle(new Request(`${base}/api/todos/list?q=fir`));
    assert.equal(listed.status, 200);
    assert.deepEqual(await listed.json(), { items: ['first'] });
    const added = await handle(
      new Request(`${base}/api/todos/add`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'second' }),
      }),
    );
    assert.deepEqual(await added.json(), { count: 2 });
    assert.equal(
      (await handle(new Request(`${base}/api/todos/secret`, { method: 'POST' }))).status,
      404,
    );
    assert.equal((await handle(new Request(`${base}/elsewhere`))).status, 404);
    const before = ran.length;
    const foreign = await handle(
      new Request(`${base}/api/todos/add`, {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
          'sec-fetch-site': 'cross-site',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'x' }),
      }),
    );
    assert.equal(foreign.status, 403);
    assert.equal(ran.length, before, 'a cross-site request runs nothing');
    const trusted = orpcHandler(server, {
      prefix: '/api',
      protocol: 'openapi',
      trustedOrigins: ['https://admin.example'],
    });
    const fromAdmin = await trusted(
      new Request(`${base}/api/todos/list`, { headers: { origin: 'https://admin.example' } }),
    );
    assert.equal(fromAdmin.status, 200);
  } finally {
    await server.stop();
  }
});

test('the OpenAPI document: one path per exposed operation, bodies from the JSON Schemas', async () => {
  const { server } = app();
  try {
    const document = await openapiDocument(server, { prefix: '/api', info: { title: 'Todos' } });
    assert.equal(document.info.title, 'Todos');
    assert.deepEqual(document.servers, [{ url: '/api' }]);
    assert.deepEqual(Object.keys(document.paths).sort(), [
      '/todos/add',
      '/todos/fail',
      '/todos/list',
    ]);
    assert.equal(document.paths['/todos/list'].get.operationId, 'todos.list');
    assert.equal(document.paths['/todos/list'].get.summary, 'List todos');
    const body = document.paths['/todos/add'].post.requestBody.content['application/json'].schema;
    assert.deepEqual(body.required, ['title']);
    assert.equal(body.properties.title.type, 'string');
  } finally {
    await server.stop();
  }
});
