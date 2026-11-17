import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createServer,
  defineAction,
  definePermissions,
  definePlugin,
  isBitaKitStartupError,
  isOperationError,
} from '../dist/server/index.js';
import { as, people, provider, quiet, rejection, serverOf } from './server-fixtures.mjs';

const seen = (access) =>
  defineAction({
    access,
    expose: true,
    execute: ({ ctx }) => ({
      keys: Object.keys(ctx).sort(),
      user: ctx.user?.id ?? null,
      organization: ctx.organization?.id ?? null,
      frozen: Object.isFrozen(ctx) && (!ctx.user || Object.isFrozen(ctx.user)),
    }),
  });

const outcome = async (promise) => {
  try {
    return await promise;
  } catch (error) {
    assert.ok(isOperationError(error), String(error));
    return error.reason ? `${error.code}:${error.reason}` : error.code;
  }
};

test('access matrix: public, user, organization and permission against every kind of caller', async () => {
  const server = serverOf({
    open: seen('public'),
    mine: seen('user'),
    team: seen('organization'),
    create: seen({ permission: { todos: ['create'] } }),
  });
  try {
    const matrix = {};
    for (const who of ['anonymous', 'member', 'other', 'lonely', 'outsider']) {
      const caller = server.as(as(who));
      matrix[who] = await Promise.all(
        ['open', 'mine', 'team', 'create'].map(async (name) => {
          const result = await outcome(caller.todos[name]());
          return typeof result === 'string' ? result : 'ok';
        }),
      );
    }
    assert.deepEqual(matrix, {
      anonymous: ['ok', 'UNAUTHORIZED', 'UNAUTHORIZED', 'UNAUTHORIZED'],
      member: ['ok', 'ok', 'ok', 'ok'],
      other: ['ok', 'ok', 'ok', 'FORBIDDEN:PERMISSION'],
      lonely: ['ok', 'ok', 'FORBIDDEN:NO_ACTIVE_ORGANIZATION', 'FORBIDDEN:NO_ACTIVE_ORGANIZATION'],
      outsider: ['ok', 'ok', 'FORBIDDEN:NOT_A_MEMBER', 'FORBIDDEN:NOT_A_MEMBER'],
    });
    // ctx carries exactly what the access level verified, frozen.
    const member = server.as(as('member'));
    assert.deepEqual(await member.todos.open(), {
      keys: ['requestId', 'signal'],
      user: null,
      organization: null,
      frozen: true,
    });
    assert.deepEqual(await member.todos.mine(), {
      keys: ['requestId', 'signal', 'user'],
      user: 'u1',
      organization: null,
      frozen: true,
    });
    assert.deepEqual(await member.todos.team(), {
      keys: ['can', 'member', 'organization', 'requestId', 'signal', 'user'],
      user: 'u1',
      organization: 'o1',
      frozen: true,
    });
  } finally {
    await server.stop();
  }
});

test('the provider answer is normalized: empty IDs, an organization without a user and a non-function can never grant', async () => {
  const table = {
    empty: { user: { id: '' }, organization: { id: 'o1' } },
    orphan: { user: null, organization: { id: 'o1' } },
    blank: { user: { id: 'u1' }, organization: { id: '' } },
    fake: { user: { id: 'u1' }, organization: { id: 'o1' }, can: true },
  };
  const server = serverOf(
    {
      team: seen('organization'),
      create: seen({ permission: { todos: ['create'] } }),
    },
    { services: { requestContext: provider(table) } },
  );
  try {
    assert.equal(await outcome(server.as(as('empty')).todos.team()), 'UNAUTHORIZED');
    assert.equal(await outcome(server.as(as('orphan')).todos.team()), 'UNAUTHORIZED');
    assert.equal(
      await outcome(server.as(as('blank')).todos.team()),
      'FORBIDDEN:NO_ACTIVE_ORGANIZATION',
    );
    assert.equal(await outcome(server.as(as('fake')).todos.create()), 'FORBIDDEN:PERMISSION');
  } finally {
    await server.stop();
  }
});

test('identities from model instances: the IDs that were checked are the IDs execute sees', async () => {
  // ORM models (Sequelize, Mongoose) expose fields through prototype getters, which a spread drops.
  class Model {
    #fields;
    constructor(fields) {
      this.#fields = fields;
    }
    get id() {
      return this.#fields.id;
    }
    get name() {
      return this.#fields.name;
    }
    get role() {
      return this.#fields.role;
    }
  }
  let reads = 0;
  const table = {
    model: {
      user: new Model({ id: 'u1', name: 'Mia' }),
      organization: Object.defineProperty({}, 'id', { value: 'o1', enumerable: false }),
      member: new Model({ id: 'm1', role: 'admin' }),
    },
    // An ID read twice could pass the check as one user and run as another.
    fickle: {
      user: {
        get id() {
          reads += 1;
          return reads === 1 ? 'u1' : 'u2';
        },
      },
    },
  };
  const server = serverOf(
    {
      team: defineAction({
        access: 'organization',
        execute: ({ ctx }) => ({
          user: ctx.user.id,
          name: ctx.user.name,
          organization: ctx.organization.id,
          member: [ctx.member.id, ctx.member.role],
          frozen: [ctx.user, ctx.organization, ctx.member].every(Object.isFrozen),
        }),
      }),
      me: defineAction({ access: 'user', execute: ({ ctx }) => ctx.user.id }),
    },
    { services: { requestContext: provider(table) } },
  );
  try {
    assert.deepEqual(await server.as(as('model')).todos.team(), {
      user: 'u1',
      name: 'Mia',
      organization: 'o1',
      member: ['m1', 'admin'],
      frozen: true,
    });
    assert.equal(await server.as(as('fickle')).todos.me(), 'u1');
  } finally {
    await server.stop();
  }
});

test('can grants only an answer === true: {success:false}, undefined and a throw deny', async () => {
  const answers = {
    object: () => ({ success: false }),
    truthy: () => 'yes',
    missing: () => undefined,
    async: async () => true,
    throws: () => {
      throw new Error('provider down');
    },
  };
  const table = Object.fromEntries(
    Object.entries(answers).map(([name, can]) => [
      name,
      { user: { id: name }, organization: { id: 'o1' }, can },
    ]),
  );
  const server = serverOf(
    {
      create: defineAction({
        access: { permission: { todos: ['create'] } },
        execute: async ({ ctx }) => ({ again: await ctx.can({ todos: ['create'] }) }),
      }),
    },
    { services: { requestContext: provider(table) } },
  );
  try {
    const logged = await quiet('error', async () => {
      for (const name of ['object', 'truthy', 'missing', 'throws'])
        assert.equal(
          await outcome(server.as(as(name)).todos.create()),
          'FORBIDDEN:PERMISSION',
          name,
        );
    });
    assert.equal(logged.length, 1, 'a throwing can is logged');
    assert.deepEqual(await server.as(as('async')).todos.create(), { again: true });
  } finally {
    await server.stop();
  }
});

test('a throwing provider answers INTERNAL_SERVER_ERROR with a reference and never grants', async () => {
  const server = serverOf(
    { mine: seen('user') },
    {
      services: {
        requestContext: {
          resolve: () => {
            throw new Error('database password leaked here');
          },
        },
      },
    },
  );
  try {
    const logged = await quiet('error', async () => {
      const error = await rejection(server.as(as('member')).todos.mine());
      assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
      assert.match(error.safeMessage, /^Something went wrong\. Reference: [0-9a-f-]{36}$/);
      assert.doesNotMatch(JSON.stringify(error), /password/);
    });
    assert.ok(logged.some((line) => String(line[1]).includes('password')));
  } finally {
    await server.stop();
  }
});

test('a stale or empty organization header conflicts; an absent one is not checked', async () => {
  const server = serverOf({ team: seen('organization'), mine: seen('user') });
  try {
    const call = (headers, options) =>
      outcome(server.call('todos.team', undefined, as('member', headers), options));
    assert.equal(typeof (await call({})), 'object');
    assert.equal(typeof (await call({ 'x-bitakit-organization': 'o1' })), 'object');
    assert.equal(await call({ 'x-bitakit-organization': 'o2' }), 'CONFLICT:ORGANIZATION_CHANGED');
    assert.equal(await call({ 'x-bitakit-organization': '' }), 'CONFLICT:ORGANIZATION_CHANGED');
    // The call option wins over the header; null means "none".
    assert.equal(
      typeof (await call({ 'x-bitakit-organization': 'o2' }, { organizationId: 'o1' })),
      'object',
    );
    assert.equal(await call({}, { organizationId: null }), 'CONFLICT:ORGANIZATION_CHANGED');
    // Only organization and permission rules compare organizations.
    assert.equal(
      typeof (await outcome(
        server.call('todos.mine', undefined, as('member', { 'x-bitakit-organization': 'o9' })),
      )),
      'object',
    );
  } finally {
    await server.stop();
  }
});

test('missing, malformed or misspelled access is a startup error naming the operation and file', async () => {
  const cases = [
    [undefined, /server:todos\.bad in plugin "todos" needs access/],
    ['organisation', /unknown access "organisation"/],
    [{ permission: {} }, /at least one resource/],
    [{ permission: { todos: [] } }, /non-empty list of operation names for "todos"/],
    [{ permission: { todos: [''] } }, /non-empty list/],
    [{ permission: { todos: ['create'] }, role: 'admin' }, /holds only \{ permission \}/],
    [['user'], /invalid access/],
  ];
  for (const [access, message] of cases) {
    const server = serverOf({ bad: defineAction({ access, execute: () => 1 }) });
    await quiet('error', async () => {
      const error = await rejection(server.ready);
      assert.ok(isBitaKitStartupError(error));
      assert.match(error.message, message);
      assert.equal(error.plugin, 'todos');
    });
    await server.stop();
  }
});

test('with a permission catalog, unknown resources and operations are startup errors', async () => {
  const plugin = (access) =>
    createServer(
      {
        plugins: [
          definePlugin({
            id: 'todos',
            permissions: definePermissions({ todos: ['create', 'read'] }),
            actions: { add: defineAction({ access, execute: () => 1 }) },
          }),
        ],
      },
      { services: { requestContext: provider() } },
    );
  const known = plugin({ permission: { todos: ['create'] } });
  await known.ready;
  await known.stop();
  for (const [access, message] of [
    [{ permission: { notes: ['create'] } }, /unknown permission resource "notes"/],
    [{ permission: { todos: ['delete'] } }, /unknown operations "delete" of "todos"/],
  ]) {
    const server = plugin(access);
    await quiet('error', async () => {
      const error = await rejection(server.ready);
      assert.match(error.message, message);
    });
    await server.stop();
  }
});

test('non-public operations without a requestContext provider fail at boot with the fix', async () => {
  const server = serverOf({ open: seen('public'), team: seen('organization') }, { services: {} });
  await quiet('error', async () => {
    const error = await rejection(server.ready);
    assert.ok(isBitaKitStartupError(error));
    assert.match(error.message, /server:todos\.team .* no service provides requestContext/);
    assert.match(error.message, /src\/server\/services\/request-context\.ts/);
  });
  await server.stop();
  // Public operations alone need no provider.
  const open = serverOf({ open: seen('public') }, { services: {} });
  assert.equal((await open.as(new Headers()).todos.open()).user, null);
  await open.stop();
  assert.ok(people.member.user.id);
});

test('the provider receives the exact Request given to as() or call(); Headers get the internal URL', async () => {
  const received = [];
  const server = serverOf(
    { mine: seen('user') },
    {
      services: {
        requestContext: {
          resolve: (request) => {
            received.push(request);
            return people.member;
          },
        },
      },
    },
  );
  try {
    const request = new Request('https://app.example.com/page', { headers: { cookie: 's=1' } });
    const caller = server.as(request);
    await caller.todos.mine();
    await caller.todos.mine();
    await server.call('todos.mine', undefined, request, { exposedOnly: false });
    await server.as(new Headers({ cookie: 's=2' })).todos.mine();
    assert.equal(received.length, 3, 'one resolution per caller, memoized');
    assert.equal(received[0], request);
    assert.equal(received[1], request);
    assert.equal(received[2].url, 'http://bitakit.internal/');
    assert.equal(received[2].headers.get('cookie'), 's=2');
  } finally {
    await server.stop();
  }
});
