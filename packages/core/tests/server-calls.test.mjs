import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  createServer,
  defineAction,
  defineEvents,
  defineInterceptor,
  definePlugin,
  defineService,
  event,
  isBitaKitStartupError,
  OperationError,
} from '../dist/server/index.js';
import { as, provider, quiet, rejection, serverOf } from './server-fixtures.mjs';

const standard = (validate) => ({ '~standard': { version: 1, vendor: 'test', validate } });

test('input is validated once with issue paths; zod and Standard Schema keep them', async () => {
  let parsed = 0;
  const server = serverOf({
    add: defineAction({
      access: 'public',
      input: z.object({
        title: z.string().min(1),
        tags: z.array(z.string()),
      }),
      execute: ({ input }) => input,
    }),
    rename: defineAction({
      access: 'public',
      input: standard(async (value) => {
        parsed += 1;
        return typeof value?.name === 'string'
          ? { value: { name: value.name.trim() } }
          : { issues: [{ message: 'Name is required.', path: [{ key: 'name' }] }] };
      }),
      execute: ({ input }) => input,
    }),
  });
  try {
    const caller = server.as(new Headers());
    const error = await rejection(caller.todos.add({ title: '', tags: ['a', 3] }));
    assert.equal(error.code, 'BAD_REQUEST');
    assert.equal(error.safeMessage, 'Invalid input.');
    assert.deepEqual(
      error.issues.map((issue) => issue.path),
      [['title'], ['tags', 1]],
    );
    assert.deepEqual(await caller.todos.add({ title: 'Milk', tags: [], extra: 1 }), {
      title: 'Milk',
      tags: [],
    });
    const named = await rejection(caller.todos.rename({}));
    assert.deepEqual(named.toJSON().issues, [{ path: ['name'], message: 'Name is required.' }]);
    assert.deepEqual(await caller.todos.rename({ name: '  Ada ' }), { name: 'Ada' });
    assert.equal(parsed, 2, 'one validation per call');
  } finally {
    await server.stop();
  }
});

test('a failing schema is a logged 500; a parse that throws without issues never sends its message', async () => {
  const secret = 'connect ECONNREFUSED 10.0.0.5:5432 (user=app_admin)';
  const crash = () => {
    throw new Error(secret);
  };
  const server = serverOf({
    // A Standard Schema reports invalid values as issues; a throw or rejection is a server fault.
    refine: defineAction({
      access: 'public',
      input: z.object({ email: z.string().refine(crash) }),
      execute: () => 'ran',
    }),
    lookup: defineAction({
      access: 'public',
      input: standard(async () => crash()),
      execute: () => 'ran',
    }),
    thrown: defineAction({ access: 'public', input: standard(crash), execute: () => 'ran' }),
    output: defineAction({ access: 'public', output: standard(crash), execute: () => 'ran' }),
    // `parse` signals invalid input by throwing: structured issues are kept, anything else is a
    // fixed issue with a reference, and an OperationError is the parser's own safe answer.
    parsed: defineAction({
      access: 'public',
      input: { parse: (value) => value.missing.field },
      execute: () => 'ran',
    }),
    zodParse: defineAction({
      access: 'public',
      input: { parse: (value) => z.object({ title: z.string() }).parse(value) },
      execute: () => 'ran',
    }),
    own: defineAction({
      access: 'public',
      input: {
        parse: () => {
          throw new OperationError('BAD_REQUEST', 'Pick a list first.', { reason: 'NO_LIST' });
        },
      },
      execute: () => 'ran',
    }),
  });
  try {
    const caller = server.as(new Headers());
    const errors = await quiet('error', async () => {
      for (const name of ['refine', 'lookup', 'thrown', 'output']) {
        const input = name === 'output' ? undefined : { email: 'a@b.c' };
        const error = await rejection(caller.todos[name](input));
        assert.equal(error.code, 'INTERNAL_SERVER_ERROR', name);
        assert.equal(error.safeMessage, `Something went wrong. Reference: ${error.requestId}`);
        assert.doesNotMatch(JSON.stringify(error.toJSON()), /ECONNREFUSED/);
      }
    });
    assert.equal(errors.length, 4);
    assert.ok(errors.every(([line, cause]) => /reference /.test(line) && cause.message === secret));
    const warnings = await quiet('warn', async () => {
      const error = await rejection(caller.todos.parsed({}));
      assert.deepEqual(error.toJSON(), {
        code: 'BAD_REQUEST',
        message: 'Invalid input.',
        issues: [{ path: [], message: 'Invalid value.' }],
        requestId: error.requestId,
      });
      assert.equal(typeof error.requestId, 'string');
    });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][0], /server:todos\.parsed threw without issues/);
    assert.ok(warnings[0][1] instanceof TypeError);
    const structured = await rejection(caller.todos.zodParse({ title: 1 }));
    assert.deepEqual(
      structured.issues.map((issue) => issue.path),
      [['title']],
    );
    assert.deepEqual((await rejection(caller.todos.own({}))).toJSON(), {
      code: 'BAD_REQUEST',
      message: 'Pick a list first.',
      reason: 'NO_LIST',
    });
  } finally {
    await server.stop();
  }
});

test('an async parse is awaited: execute gets the value, invalid input never runs it', async () => {
  const unhandled = [];
  const track = (error) => unhandled.push(error);
  process.on('unhandledRejection', track);
  const received = [];
  const server = serverOf({
    add: defineAction({
      access: 'public',
      input: {
        parse: async (value) => {
          await new Promise((resolve) => setTimeout(resolve));
          if (typeof value?.title !== 'string') z.object({ title: z.string() }).parse(value);
          return { title: value.title.trim() };
        },
      },
      output: { parse: async (value) => ({ ...value, checked: true }) },
      execute: ({ input }) => {
        received.push(input);
        return input;
      },
    }),
  });
  try {
    const caller = server.as(new Headers());
    assert.deepEqual(await caller.todos.add({ title: ' Milk ' }), { title: 'Milk', checked: true });
    const error = await rejection(caller.todos.add({ title: 42 }));
    assert.equal(error.code, 'BAD_REQUEST');
    assert.deepEqual(
      error.issues.map((issue) => issue.path),
      [['title']],
    );
    assert.deepEqual(received, [{ title: 'Milk' }]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', track);
    await server.stop();
  }
});

test('an operation without an input schema takes no input', async () => {
  const server = serverOf({ clear: defineAction({ access: 'public', execute: () => 'cleared' }) });
  try {
    const caller = server.as(new Headers());
    assert.equal(await caller.todos.clear(), 'cleared');
    for (const input of [{}, null, 0, '']) {
      const error = await rejection(caller.todos.clear(input));
      assert.equal(error.code, 'BAD_REQUEST');
      assert.equal(error.safeMessage, 'This operation takes no input.');
    }
  } finally {
    await server.stop();
  }
});

test('the output schema value is returned (extra keys stripped); a rejected result is a 500', async () => {
  const server = serverOf({
    read: defineAction({
      access: 'public',
      output: z.object({ id: z.string() }),
      execute: () => ({ id: 'a', secret: 'hash' }),
    }),
    broken: defineAction({
      access: 'public',
      output: z.object({ id: z.string() }),
      execute: () => ({ id: 1 }),
    }),
  });
  try {
    const caller = server.as(new Headers());
    assert.deepEqual(await caller.todos.read(), { id: 'a' });
    const logged = await quiet('error', async () => {
      const error = await rejection(caller.todos.broken());
      assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
      assert.equal(error.issues, undefined);
    });
    assert.equal(logged.length, 1);
  } finally {
    await server.stop();
  }
});

test('only a branded OperationError passes through; error-like objects become a logged 500', async () => {
  const server = serverOf({
    missing: defineAction({
      access: 'public',
      execute: () => {
        throw new OperationError('NOT_FOUND', 'No such todo.', { cause: new Error('row 7') });
      },
    }),
    lookalike: defineAction({
      access: 'public',
      execute: () => {
        throw Object.assign(new Error('SELECT * FROM users'), {
          code: 'NOT_FOUND',
          safeMessage: 'x',
        });
      },
    }),
    plain: defineAction({
      access: 'public',
      execute: async () => {
        throw { code: 'FORBIDDEN', message: 'internal' };
      },
    }),
  });
  try {
    const caller = server.as(new Headers());
    const missing = await rejection(caller.todos.missing());
    assert.deepEqual(missing.toJSON(), { code: 'NOT_FOUND', message: 'No such todo.' });
    const logged = await quiet('error', async () => {
      for (const name of ['lookalike', 'plain']) {
        const error = await rejection(caller.todos[name]());
        assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
        assert.equal(error.status, 500);
        assert.match(error.safeMessage, new RegExp(`Reference: ${error.requestId}$`));
        assert.doesNotMatch(JSON.stringify(error.toJSON()), /SELECT|internal/);
      }
    });
    assert.equal(logged.length, 2, 'each original error is logged once with its reference');
    assert.ok(logged.every(([line]) => /reference [0-9a-f-]{36}/.test(line)));
  } finally {
    await server.stop();
  }
});

test('server interceptors: ordered, after validation, with ctx; false rejects as INTERCEPTED; after/onError observe', async () => {
  const log = [];
  const server = createServer(
    {
      interceptors: [
        defineInterceptor({
          order: 2,
          before: ({ id, input, ctx }) =>
            void log.push(`app:${id}:${input?.title}:${ctx.user?.id}`),
        }),
      ],
      plugins: [
        definePlugin({
          id: 'todos',
          interceptors: [
            defineInterceptor({
              action: 'todos.*',
              order: 1,
              before: ({ input }) => void log.push(`todos:${input?.title}`),
              after: ({ result }) => void log.push(`after:${result}`),
              onError: ({ error }) => void log.push(`error:${error.reason ?? error.message}`),
            }),
            defineInterceptor({
              action: 'todos.remove',
              before: async () => false,
            }),
          ],
          actions: {
            add: defineAction({
              access: 'user',
              input: z.object({ title: z.string().trim() }),
              execute: ({ input }) => input.title,
            }),
            remove: defineAction({ access: 'user', execute: () => 'removed' }),
          },
        }),
        definePlugin({
          id: 'notes',
          actions: { add: defineAction({ access: 'user', execute: () => 'note' }) },
        }),
      ],
    },
    { services: { requestContext: provider() } },
  );
  try {
    const caller = server.as(as('member'));
    assert.equal(await caller.todos.add({ title: ' Milk ' }), 'Milk');
    const blocked = await rejection(caller.todos.remove());
    assert.deepEqual(blocked.toJSON(), {
      code: 'FORBIDDEN',
      message: 'This action is not allowed.',
      reason: 'INTERCEPTED',
    });
    assert.equal(await caller.notes.add(), 'note');
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(log, [
      'todos:Milk',
      'app:todos.add:Milk:u1',
      'after:Milk',
      // order 0 (the remove gate) runs first and stops the chain
      'error:INTERCEPTED',
      'app:notes.add:undefined:u1',
    ]);
    // Access is checked before any interceptor runs.
    log.length = 0;
    assert.equal(
      (await rejection(server.as(as('anonymous')).todos.add({ title: 'x' }))).code,
      'UNAUTHORIZED',
    );
    assert.deepEqual(log, []);
  } finally {
    await server.stop();
  }
});

test('interceptor contexts are frozen: no interceptor changes what the next one, execute or an observer sees', async () => {
  const seen = [];
  const server = createServer(
    {
      plugins: [
        definePlugin({
          id: 'todos',
          interceptors: [
            defineInterceptor({
              action: 'todos.add',
              order: 0,
              before: (context) => {
                seen.push(['frozen', Object.isFrozen(context)]);
                if (context.input.list !== 'victim') return;
                context.input = { list: 'mine' };
              },
            }),
            defineInterceptor({
              action: 'todos.add',
              order: 10,
              before: ({ input }) => void seen.push(['guard', input.list]),
              after: (context) =>
                void seen.push(['after', Object.isFrozen(context), context.result]),
              onError: (context) => void seen.push(['onError', Object.isFrozen(context)]),
            }),
          ],
          actions: {
            add: defineAction({
              access: 'public',
              input: z.object({ list: z.string() }),
              execute: ({ input }) => {
                seen.push(['execute', input.list]);
                return input.list;
              },
            }),
          },
        }),
      ],
    },
    { services: { requestContext: provider() } },
  );
  try {
    const caller = server.as(new Headers());
    assert.equal(await caller.todos.add({ list: 'mine' }), 'mine');
    // Replacing the input is refused (strict mode throws), so the call fails instead of the guard
    // checking one value while execute runs with another.
    await quiet('error', async () => {
      assert.equal(
        (await rejection(caller.todos.add({ list: 'victim' }))).code,
        'INTERNAL_SERVER_ERROR',
      );
    });
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(seen, [
      ['frozen', true],
      ['guard', 'mine'],
      ['execute', 'mine'],
      ['after', true, 'mine'],
      ['frozen', true],
      ['onError', true],
    ]);
  } finally {
    await server.stop();
  }
});

test('events emitted by an operation reach listeners with { signal, ctx }; other emits carry no ctx', async () => {
  const received = [];
  const server = createServer(
    {
      plugins: [
        definePlugin({
          id: 'todos',
          events: defineEvents({ added: event() }),
          services: {
            audit: defineService(({ events }) => {
              events.on('todos.added', (event, context) =>
                received.push({
                  data: event.data,
                  keys: Object.keys(context).sort(),
                  user: context.ctx?.user?.id,
                  inEvent: 'ctx' in event,
                }),
              );
              return { emitOutside: () => events.emit('todos.added', 'outside') };
            }),
          },
          actions: {
            add: defineAction({
              access: 'user',
              execute: ({ events }) => {
                events.emit('todos.added', 'inside');
              },
            }),
            outside: defineAction({
              access: 'public',
              execute: ({ services }) => services.todos.audit.emitOutside(),
            }),
          },
        }),
      ],
    },
    { services: { requestContext: provider() } },
  );
  try {
    await server.as(as('member')).todos.add();
    await server.as(as('member')).todos.outside();
    assert.deepEqual(received, [
      { data: 'inside', keys: ['ctx', 'signal'], user: 'u1', inEvent: false },
      { data: 'outside', keys: ['signal'], user: undefined, inEvent: false },
    ]);
  } finally {
    await server.stop();
  }
});

test('execute receives id, input, ctx, services, config (with overrides), events, settings and signal', async () => {
  let keys;
  const server = createServer({
    configOverrides: { todos: { limit: 9 } },
    plugins: [
      definePlugin({
        id: 'todos',
        config: { limit: 3 },
        services: { store: defineService(() => ({ size: () => 2 })) },
        actions: {
          inspect: defineAction({
            access: 'public',
            execute: (context) => {
              keys = Object.keys(context).sort();
              return [
                context.id,
                context.services.todos.store.size(),
                context.config.plugin.get('limit'),
                context.signal instanceof AbortSignal,
                context.ctx.signal === context.signal,
              ];
            },
          }),
        },
      }),
    ],
  });
  try {
    assert.deepEqual(await server.as(new Headers()).todos.inspect(), [
      'todos.inspect',
      2,
      9,
      true,
      true,
    ]);
    assert.deepEqual(keys, [
      'config',
      'ctx',
      'events',
      'id',
      'input',
      'services',
      'settings',
      'signal',
    ]);
    // In-process names fold case like Core; the exact ID always wins.
    assert.equal((await server.as(new Headers()).Todos.INSPECT())[0], 'todos.inspect');
  } finally {
    await server.stop();
  }
});

test('duplicate operation IDs across the app and plugins fail at boot, also when equal ignoring case', async () => {
  for (const appKey of ['todos.clear', 'Todos.Clear']) {
    const server = createServer({
      actions: { [appKey]: defineAction({ access: 'public', execute: () => 'app' }) },
      plugins: [
        definePlugin({
          id: 'todos',
          actions: { clear: defineAction({ access: 'public', execute: () => 'plugin' }) },
        }),
      ],
    });
    await quiet('error', async () => {
      const error = await rejection(server.ready);
      assert.ok(isBitaKitStartupError(error));
      assert.match(error.message, /Duplicate server Action ID/);
      assert.match(error.message, /server:todos\.clear in plugin "todos"/);
      assert.match(error.message, new RegExp(`server:${appKey.replace('.', '\\.')} in the app`));
    });
    await server.stop();
  }
});

test('client-only fields, a non-boolean expose, non-schemas and missing services are startup errors', async () => {
  const cases = [
    [
      { access: 'public', enabled: false, execute: () => 1 },
      /client-only field "enabled".*actions\/bad\.ts/,
    ],
    [{ access: 'public', confirm: 'Sure?', execute: () => 1 }, /client-only field "confirm"/],
    [
      { access: 'public', expose: 'false', execute: () => 1 },
      /has expose "false"; use true or false/,
    ],
    [
      { access: 'public', input: { check: () => 1 }, execute: () => 1 },
      /input that is not a schema/,
    ],
    [{ access: 'public', requires: ['billing.ledger'], execute: () => 1 }, /billing\.ledger/],
    [{ access: 'public' }, /needs execute/],
  ];
  for (const [spec, message] of cases) {
    const server = serverOf({ bad: defineAction(spec) });
    await quiet('error', async () => {
      const error = await rejection(server.ready);
      assert.ok(isBitaKitStartupError(error), String(error));
      assert.match(error.message, message);
      assert.match(error.message, /server:todos\.bad/);
    });
    await server.stop();
  }
});

test('server Action IDs with a reserved segment are startup errors naming the name and file', async () => {
  for (const key of ['subscribe', 'then', 'toJSON', 'lists.valueOf', 'constructor']) {
    const server = serverOf({ [key]: defineAction({ access: 'public', execute: () => 1 }) });
    await quiet('error', async () => {
      const error = await rejection(server.ready);
      assert.ok(isBitaKitStartupError(error), String(error));
      assert.equal(error.plugin, 'todos');
      assert.match(
        error.message,
        new RegExp(
          `server:todos\\.${key.replace('.', '\\.')} .*uses the reserved name "${key.split('.').pop()}"`,
        ),
      );
    });
    await server.stop();
  }
  // Only the exact spelling is reserved.
  const server = serverOf({ Subscribe: defineAction({ access: 'public', execute: () => 'ok' }) });
  try {
    assert.equal(await server.as(new Headers()).todos.Subscribe(), 'ok');
    assert.equal(server.as(new Headers()).todos.subscribe, undefined);
  } finally {
    await server.stop();
  }
});

test('concurrent calls share no state: every one of 2,000 overlapping calls completes', async () => {
  const server = serverOf({
    echo: defineAction({
      access: 'user',
      input: z.number(),
      execute: async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, input % 3));
        return input;
      },
    }),
  });
  try {
    const caller = server.as(as('member'));
    const values = Array.from({ length: 2000 }, (_, index) => index);
    assert.deepEqual(await Promise.all(values.map((value) => caller.todos.echo(value))), values);
  } finally {
    await server.stop();
  }
});
