import test from 'node:test';
import assert from 'node:assert/strict';
import { types } from 'node:util';
import {
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  isBitaKitStartupError,
  isOperationError,
  OperationError,
} from '../dist/core.js';
import { defineAction as defineServerAction, fetchHandler } from '../dist/server/index.js';
import { as, rejection, serverOf } from './server-fixtures.mjs';

/** Replaces fetch while `run` executes; `answer(url, init)` returns a Response or throws. */
async function withFetch(answer, run) {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, method: init.method, headers: { ...init.headers }, body: init.body });
    return answer(url, init);
  };
  try {
    await run(requests);
  } finally {
    globalThis.fetch = original;
  }
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const auth = (snapshot) => ({
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
  signOut: async () => {},
});

async function mounted(config, options) {
  const runtime = createRuntime(config, options);
  runtime.mount();
  await runtime.ready;
  return runtime;
}

test('a client Action with a server field is rejected at registration with the button-vs-operation fix', async () => {
  for (const field of [
    { access: 'organization' },
    { expose: true },
    { output: { parse: (v) => v } },
  ]) {
    const runtime = createRuntime({
      plugins: [
        definePlugin({
          id: 'todos',
          actions: { add: defineAction({ ...field, execute: () => 1 }) },
        }),
      ],
    });
    let error;
    try {
      runtime.mount();
      await runtime.ready;
    } catch (failure) {
      error = failure;
    }
    assert.ok(isBitaKitStartupError(error), String(error));
    const name = Object.keys(field)[0];
    assert.match(
      error.message,
      new RegExp(
        `\`${name}\` is a server field\\. This file is the button; put the operation, with \`expose: true\`, in server/actions/add\\.ts and call it with remote\\.todos\\.add\\(\\)\\.`,
      ),
    );
    assert.equal(error.plugin, 'todos');
    await runtime.stop();
  }
});

test('remote: nested plain frozen functions that POST JSON and resolve data', async () => {
  let fromService;
  const runtime = await mounted({
    remote: {
      endpoint: '/api/rpc/',
      operations: ['todos.add', 'todos.list', 'ping', 'todos.name', 'todos', 'ping.length'],
    },
    plugins: [
      definePlugin({
        id: 'todos',
        services: {
          items: defineService(({ remote }) => {
            fromService = remote;
            return {};
          }),
        },
        actions: {
          save: defineAction({ execute: ({ remote, input }) => remote.todos.add(input) }),
        },
      }),
    ],
  });
  try {
    const { remote } = runtime;
    assert.equal(fromService, remote);
    assert.equal(typeof remote.todos.add, 'function');
    assert.equal(typeof remote.ping, 'function');
    // An ID that is also a prefix keeps its children, whatever their names.
    assert.equal(typeof remote.todos, 'function');
    assert.equal(typeof remote.todos.name, 'function');
    assert.equal(typeof remote.ping.length, 'function');
    assert.equal(types.isProxy(remote) || types.isProxy(remote.todos), false);
    assert.ok(Object.isFrozen(remote) && Object.isFrozen(remote.todos));
    assert.equal(remote.then, undefined);
    assert.equal(remote.subscribe, undefined);
    await withFetch(
      (url) => json(url.endsWith('todos.add') ? { data: { id: 'a1' } } : {}),
      async (requests) => {
        assert.deepEqual((await runtime.actions.execute('todos.save', { title: 'Milk' })).value, {
          id: 'a1',
        });
        assert.equal(await remote.todos.list(), undefined);
        assert.deepEqual(
          requests.map(({ url, method, headers, body }) => [url, method, headers, body]),
          [
            [
              '/api/rpc/todos.add',
              'POST',
              { 'content-type': 'application/json' },
              '{"title":"Milk"}',
            ],
            ['/api/rpc/todos.list', 'POST', { 'content-type': 'application/json' }, undefined],
          ],
        );
      },
    );
  } finally {
    await runtime.stop();
  }
});

test('remote sends the organization header whenever auth has a user; the call option overrides it', async () => {
  const header = async (snapshot, options) => {
    const runtime = await mounted(
      { remote: { endpoint: '/api/rpc', operations: ['todos.list'] } },
      snapshot === undefined ? {} : { services: { auth: auth(snapshot) } },
    );
    let sent;
    await withFetch(
      (_url, init) => {
        sent = init.headers['x-bitakit-organization'];
        return json({ data: 1 });
      },
      () => runtime.remote.todos.list(undefined, options),
    );
    await runtime.stop();
    return sent;
  };
  const user = { id: 'u1' };
  assert.equal(await header({ user, organizationId: 'o1', pending: false, error: null }), 'o1');
  assert.equal(await header({ user, organizationId: null, pending: false, error: null }), '');
  assert.equal(await header({ user, pending: false, error: null }), '');
  assert.equal(await header({ user: null, pending: false, error: null }), undefined);
  assert.equal(await header(undefined), undefined);
  assert.equal(
    await header(
      { user, organizationId: 'o1', pending: false, error: null },
      { organizationId: 'o0' },
    ),
    'o0',
  );
  assert.equal(
    await header(
      { user, organizationId: 'o1', pending: false, error: null },
      { organizationId: null },
    ),
    '',
  );
});

test('remote rebuilds OperationErrors; network failures and non-JSON answers have their own codes', async () => {
  const runtime = await mounted({ remote: { endpoint: '/api/rpc', operations: ['todos.add'] } });
  try {
    const call = (answer) =>
      withFetch(answer, async () => {
        throw await rejection(runtime.remote.todos.add({ title: '' }));
      }).catch((error) => error);
    const invalid = await call(() =>
      json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid input.',
            issues: [{ path: ['title'], message: 'Too short' }],
            reason: 'X',
            requestId: 'r1',
            stack: 'leak',
          },
        },
        400,
      ),
    );
    assert.ok(isOperationError(invalid) && invalid instanceof OperationError);
    assert.deepEqual(invalid.toJSON(), {
      code: 'BAD_REQUEST',
      message: 'Invalid input.',
      issues: [{ path: ['title'], message: 'Too short' }],
      reason: 'X',
      requestId: 'r1',
    });
    assert.equal(invalid.status, 400);
    const weird = await call(() =>
      json({ error: { code: 'TEAPOT', message: 'short and stout' } }, 418),
    );
    assert.equal(weird.code, 'INTERNAL_SERVER_ERROR');
    const offline = await call(() => {
      throw new TypeError('fetch failed');
    });
    assert.equal(offline.code, 'SERVICE_UNAVAILABLE');
    const html = await call(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    assert.equal(html.code, 'INTERNAL_SERVER_ERROR');
    // An abort is the caller's own cancellation, not a server failure.
    const controller = new AbortController();
    controller.abort(new Error('user left'));
    const aborted = await withFetch(
      () => {
        throw new DOMException('aborted', 'AbortError');
      },
      () => runtime.remote.todos.add({ title: 'x' }, { signal: controller.signal }),
    ).catch((error) => error);
    assert.equal(aborted.message, 'user left');
  } finally {
    await runtime.stop();
  }
});

test('remote resolves only the envelope: a proxy, a middleware or a 2xx without data never pass for success', async () => {
  const runtime = await mounted({ remote: { endpoint: '/api/rpc', operations: ['todos.add'] } });
  const answer = async (respond) => {
    let result;
    await withFetch(respond, async () => {
      result = await runtime.remote.todos.add({ title: 'x' }).then(
        (data) => ({ data }),
        (error) => ({
          code: error.code,
          message: error.safeMessage,
          branded: isOperationError(error),
        }),
      );
    });
    return result;
  };
  const text = (body, status) => () => new Response(body, { status });
  const unexpected = 'The server sent an unexpected answer.';
  try {
    for (const [respond, expected] of [
      [() => json({ data: { id: 'a1' } }), { data: { id: 'a1' } }],
      [() => json({ data: null }), { data: null }],
      [() => json({}), { data: undefined }],
      // Not the envelope, whatever the status:
      [() => json({ message: 'Bad gateway' }, 502), 'INTERNAL_SERVER_ERROR'],
      [() => json({ message: 'Too many requests' }, 429), 'TOO_MANY_REQUESTS'],
      [() => json({ error: 'Unauthorized' }, 401), 'UNAUTHORIZED'],
      [() => json({ data: 1 }, 403), 'FORBIDDEN'],
      [() => json({ foo: 1 }), 'INTERNAL_SERVER_ERROR'],
      [() => json([1, 2]), 'INTERNAL_SERVER_ERROR'],
      [() => json(null), 'INTERNAL_SERVER_ERROR'],
      [() => json({ data: 1, error: 'x' }), 'INTERNAL_SERVER_ERROR'],
      [text('Service Unavailable', 503), 'SERVICE_UNAVAILABLE'],
      [text('<html>Too large</html>', 413), 'PAYLOAD_TOO_LARGE'],
    ]) {
      const result = await answer(respond);
      if (typeof expected === 'string')
        assert.deepEqual(result, { code: expected, message: unexpected, branded: true });
      else assert.deepEqual(result, expected);
    }
    // An error object keeps its message; an unknown code takes the HTTP status's.
    assert.deepEqual(await answer(() => json({ error: { message: 'Sign in first.' } }, 401)), {
      code: 'UNAUTHORIZED',
      message: 'Sign in first.',
      branded: true,
    });
  } finally {
    await runtime.stop();
  }
});

test('reserved names: remote leaves them out with a warning, so a namespace is never observable or thenable', async () => {
  const warned = [];
  const original = console.warn;
  console.warn = (...args) => warned.push(args.join(' '));
  let runtime;
  try {
    await withFetch(
      () => json({}),
      async (requests) => {
        runtime = await mounted({
          remote: {
            endpoint: '/api/rpc',
            operations: ['newsletter.subscribe', 'newsletter.signUp', 'then', 'todos.toJSON'],
          },
          plugins: [
            definePlugin({
              id: 'newsletter',
              // A service whose instance is the namespace: the runtime observes anything with subscribe.
              services: { api: defineService(({ remote }) => remote.newsletter) },
            }),
          ],
        });
        assert.equal(requests.length, 0, 'mounting sends nothing');
        const { remote } = runtime;
        assert.equal(remote.newsletter.subscribe, undefined);
        assert.equal(remote.then, undefined);
        assert.equal(remote.todos, undefined);
        assert.equal(typeof remote.newsletter.signUp, 'function');
        assert.equal(JSON.stringify({ remote }), '{"remote":{"newsletter":{}}}');
        await runtime.stop();
        assert.equal(requests.length, 0);
      },
    );
  } finally {
    console.warn = original;
  }
  assert.equal(warned.length, 1);
  assert.match(warned[0], /remote leaves out "newsletter\.subscribe", "then", "todos\.toJSON"/);
});

test('without a remote configuration every call rejects with SERVICE_UNAVAILABLE, never a TypeError', async () => {
  const runtime = await mounted({});
  try {
    const error = await rejection(runtime.remote.todos.add({ title: 'x' }));
    assert.ok(isOperationError(error));
    assert.deepEqual(error.toJSON(), {
      code: 'SERVICE_UNAVAILABLE',
      message: 'No server operations are configured.',
    });
    assert.equal(
      (await rejection(runtime.remote.deeply.nested.name())).code,
      'SERVICE_UNAVAILABLE',
    );
    // Reserved names read as undefined at every depth, as on a configured remote where no
    // operation can have them; every other name, also valueOf-like ones nested, is a call.
    for (const name of ['then', 'subscribe', 'toJSON', 'valueOf', 'toString', 'catch']) {
      assert.equal(runtime.remote[name], undefined, name);
      assert.equal(runtime.remote.todos[name], undefined, name);
      assert.equal(runtime.remote.deeply.nested[name], undefined, name);
    }
    assert.equal(JSON.stringify({ remote: runtime.remote.todos }), '{}');
    assert.equal(
      (await rejection(runtime.remote.newsletter.signUp({}))).code,
      'SERVICE_UNAVAILABLE',
    );
  } finally {
    await runtime.stop();
  }
});

test('the remote runtime option lets a client half call its real server half in-process', async () => {
  const server = serverOf({
    list: defineServerAction({
      access: 'organization',
      expose: true,
      execute: ({ ctx }) => [`${ctx.organization.id}:milk`],
    }),
  });
  const runtime = await mounted(
    {
      plugins: [
        definePlugin({
          id: 'todos',
          services: {
            items: defineService(({ remote, store, onStart }) => {
              const items = store([]);
              onStart(async () => items.set(await remote.todos.list()));
              return { items };
            }),
          },
        }),
      ],
    },
    { remote: server.as(as('member')) },
  );
  try {
    assert.deepEqual(runtime.services.todos.items.items.get(), ['o1:milk']);
  } finally {
    await runtime.stop();
    await server.stop();
  }
});

test('the default failure text shows an OperationError safeMessage in every environment', async () => {
  const previous = process.env.NODE_ENV;
  const notified = [];
  const runtime = await mounted({
    plugins: [
      definePlugin({
        id: 'todos',
        actions: {
          stale: defineAction({
            execute: () => {
              throw new OperationError('CONFLICT', 'The list changed. Reload it.');
            },
          }),
          broken: defineAction({
            execute: () => {
              throw new Error('internal detail');
            },
          }),
        },
      }),
    ],
  });
  runtime.setNotifier((message, kind) => notified.push([kind, message]));
  const failed = (id) =>
    runtime.actions.execute(id).then(
      () => assert.fail('expected a failure'),
      (error) => error.feedback,
    );
  try {
    process.env.NODE_ENV = 'production';
    assert.equal(await failed('todos.stale'), 'The list changed. Reload it.');
    assert.equal(await failed('todos.broken'), 'Something went wrong.');
    process.env.NODE_ENV = 'development';
    assert.equal(await failed('todos.stale'), 'The list changed. Reload it.');
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(notified, [
      ['failure', 'The list changed. Reload it.'],
      ['failure', 'Something went wrong.'],
      ['failure', 'The list changed. Reload it.'],
    ]);
  } finally {
    process.env.NODE_ENV = previous;
    await runtime.stop();
  }
});

test('remote and fetchHandler round-trip through a real Request', async () => {
  const server = serverOf({
    add: defineServerAction({
      access: 'organization',
      expose: true,
      input: { parse: (value) => ({ title: String(value.title) }) },
      execute: ({ input, ctx }) => ({ ...input, organization: ctx.organization.id }),
    }),
  });
  const handle = fetchHandler(server);
  const runtime = await mounted(
    { remote: { endpoint: '/api/rpc', operations: ['todos.add'] } },
    {
      services: {
        auth: auth({ user: { id: 'u1' }, organizationId: 'o2', pending: false, error: null }),
      },
    },
  );
  try {
    await withFetch(
      (url, init) =>
        handle(
          new Request(new URL(url, 'https://app.example.com'), {
            ...init,
            headers: { ...init.headers, 'x-who': 'member' },
          }),
        ),
      async () => {
        // The session is in o1 but the screen loaded o2: the server refuses.
        const stale = await rejection(runtime.remote.todos.add({ title: 'Milk' }));
        assert.equal(stale.code, 'CONFLICT');
        assert.equal(stale.reason, 'ORGANIZATION_CHANGED');
        assert.deepEqual(
          await runtime.remote.todos.add({ title: 'Milk' }, { organizationId: 'o1' }),
          { title: 'Milk', organization: 'o1' },
        );
      },
    );
  } finally {
    await runtime.stop();
    await server.stop();
  }
});
