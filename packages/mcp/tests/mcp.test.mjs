import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  createServer,
  defineAction,
  definePlugin,
  defineService,
  OperationError,
  requestContext,
} from '@bitakit/core/server';
import { mcpHandler } from '../dist/index.js';

// Who calls comes from each HTTP request (x-user header here, a session or token in an app); `ran`
// proves which operations executed.
function app() {
  const ran = [];
  const titles = ['first'];
  const list = defineAction({
    access: 'public',
    expose: true,
    type: 'query',
    title: 'List todos',
    output: z.object({ items: z.array(z.string()) }),
    execute: () => {
      ran.push('list');
      return { items: [...titles] };
    },
  });
  const add = defineAction({
    access: 'user',
    expose: true,
    description: 'Adds a todo.',
    input: z.object({ title: z.string().min(1) }),
    execute: ({ input, ctx }) => {
      ran.push(`add:${ctx.user.id}`);
      titles.push(input.title);
      return { count: titles.length };
    },
  });
  const fail = defineAction({
    access: 'public',
    expose: true,
    execute: () => {
      throw new OperationError('CONFLICT', 'Reload first.');
    },
  });
  const other = defineAction({ access: 'public', expose: true, execute: () => ran.push('other') });
  const secret = defineAction({ access: 'public', execute: () => ran.push('secret') });
  const identity = defineService(
    () => ({
      resolve: (request) =>
        request.headers.get('x-user')
          ? { user: { id: request.headers.get('x-user') } }
          : { user: null },
    }),
    { provides: requestContext },
  );
  const server = createServer({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: { list, add, fail, other, secret },
        services: { identity },
      }),
    ],
  });
  return { server, ran };
}
const url = new URL('http://app.test/api/mcp');
async function connect(handle, headers = {}) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
      fetch: (input, init) => handle(new Request(input, init)),
    }),
  );
  return client;
}

test('only the named operations are tools; calls run as the caller of their request', async () => {
  const { server, ran } = app();
  const handle = mcpHandler(server, {
    tools: ['todos.list', 'todos.add', 'todos.fail'],
    name: 'todos',
  });
  try {
    const client = await connect(handle, { 'x-user': 'u1' });
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ['todos_list', 'todos_add', 'todos_fail'],
    );
    const add = tools.find((tool) => tool.name === 'todos_add');
    assert.equal(add.description, 'Adds a todo.');
    assert.deepEqual(add.inputSchema.required, ['title']);
    assert.equal(tools[0].annotations.readOnlyHint, true);
    assert.equal(tools[0].outputSchema.type, 'object');

    const listed = await client.callTool({ name: 'todos_list', arguments: {} });
    assert.deepEqual(listed.structuredContent, { items: ['first'] });
    const added = await client.callTool({ name: 'todos_add', arguments: { title: 'second' } });
    assert.deepEqual(JSON.parse(added.content[0].text), { count: 2 });
    // The kernel validates and refuses; the agent reads why.
    const empty = await client.callTool({ name: 'todos_add', arguments: { title: '' } });
    assert.equal(empty.isError, true);
    const failed = await client.callTool({ name: 'todos_fail', arguments: {} });
    assert.deepEqual(failed, {
      isError: true,
      content: [{ type: 'text', text: 'CONFLICT: Reload first.' }],
    });
    // Exposed but not named, and private operations, are no tools.
    for (const name of ['todos_other', 'todos_secret'])
      assert.equal((await client.callTool({ name, arguments: {} })).isError, true);
    await client.close();

    // Without a user the same tool is refused by its access, not by MCP.
    const anonymous = await connect(handle);
    const refused = await anonymous.callTool({ name: 'todos_add', arguments: { title: 'x' } });
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /^UNAUTHORIZED:/);
    await anonymous.close();
    assert.deepEqual(ran, ['list', 'add:u1']);
  } finally {
    await server.stop();
  }
});

test('other sites are refused before any tool runs; unknown or private operations stop the handler', async () => {
  const { server, ran } = app();
  try {
    const handle = mcpHandler(server, { tools: ['todos.list'] });
    const foreign = await handle(
      new Request(url, {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
          'sec-fetch-site': 'cross-site',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
    );
    assert.equal(foreign.status, 403);
    assert.deepEqual(ran, []);
    assert.throws(() => mcpHandler(server, { tools: [] }), /at least one operation/);
    await assert.rejects(
      connect(mcpHandler(server, { tools: ['todos.secret'] })),
      /not exposed|failed|Error/,
    );
    await assert.rejects(
      connect(mcpHandler(server, { tools: ['todos.nope'] })),
      /not an operation|failed|Error/,
    );
  } finally {
    await server.stop();
  }
});
