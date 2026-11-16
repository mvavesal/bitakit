import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, defineAction, definePlugin, requestContext } from '@bitakit/core/server';
import { createRequestContext } from '../src/server/request-context.ts';

const user = { id: 'user-1', name: 'Alice (test)', email: 'alice@example.test' };
const enabled = { id: 'member-1', organizationId: 'org-1', userId: 'user-1', role: 'member' };
const request = () => new Request('http://127.0.0.1:3103/api/rpc/todos.list');

/**
 * Better Auth's `auth.api` as the request context reads it: the session and the active member
 * of the request. `member` may be an Error, which `getActiveMember` throws.
 */
function stubAuth({ activeOrganizationId = 'org-1', member = enabled, session = true } = {}) {
  const calls = [];
  return {
    calls,
    api: {
      async getSession({ headers }) {
        calls.push(['getSession', headers]);
        return session ? { user, session: { activeOrganizationId } } : null;
      },
      async getActiveMember({ headers }) {
        calls.push(['getActiveMember', headers]);
        if (member instanceof Error) throw member;
        return member;
      },
    },
  };
}
const notAMember = { user, organization: null, reason: 'NOT_A_MEMBER' };

test('an enabled member of the active organization gets it', async () => {
  const auth = stubAuth();
  const incoming = request();
  assert.deepEqual(await createRequestContext(auth).resolve(incoming), {
    user,
    organization: { id: 'org-1' },
    member: { id: 'member-1', role: 'member' },
  });
  // Both calls read the session of this request (its cookie header).
  assert.deepEqual(
    auth.calls.map(([name, headers]) => [name, headers === incoming.headers]),
    [
      ['getSession', true],
      ['getActiveMember', true],
    ],
  );
});

test('a disabled member gets no organization', async () => {
  const auth = stubAuth({ member: { ...enabled, disabled: true } });
  assert.deepEqual(await createRequestContext(auth).resolve(request()), notAMember);
});

test('a membership of another organization or another user grants nothing', async () => {
  for (const member of [
    { ...enabled, organizationId: 'org-2' },
    { ...enabled, userId: 'user-2' },
  ])
    assert.deepEqual(
      await createRequestContext(stubAuth({ member })).resolve(request()),
      notAMember,
    );
});

test('a membership that cannot be read is no membership', async () => {
  for (const member of [new Error('Member not found'), null])
    assert.deepEqual(
      await createRequestContext(stubAuth({ member })).resolve(request()),
      notAMember,
    );
});

test('without an active organization the membership is not read', async () => {
  const auth = stubAuth({ activeOrganizationId: null });
  assert.deepEqual(await createRequestContext(auth).resolve(request()), {
    user,
    organization: null,
    reason: 'NO_ACTIVE_ORGANIZATION',
  });
  assert.deepEqual(
    auth.calls.map(([name]) => name),
    ['getSession'],
  );
});

test('without a session there is no user', async () => {
  assert.deepEqual(await createRequestContext(stubAuth({ session: false })).resolve(request()), {
    user: null,
  });
});

test('the server turns these identities into its refusals', async () => {
  // One organization operation, answered with the provider under test as the app's requestContext.
  const serve = (auth) =>
    createServer(
      {
        plugins: [
          definePlugin({
            id: 'probe',
            actions: {
              organization: defineAction({
                access: 'organization',
                execute: ({ ctx }) => ctx.organization.id,
              }),
            },
          }),
        ],
      },
      { services: { [requestContext]: createRequestContext(auth) } },
    );
  const call = async (auth) => {
    const server = serve(auth);
    try {
      return await server.as(request()).probe.organization();
    } finally {
      await server.stop();
    }
  };
  assert.equal(await call(stubAuth()), 'org-1');
  await assert.rejects(call(stubAuth({ member: { ...enabled, disabled: true } })), {
    code: 'FORBIDDEN',
    reason: 'NOT_A_MEMBER',
  });
  await assert.rejects(call(stubAuth({ activeOrganizationId: null })), {
    code: 'FORBIDDEN',
    reason: 'NO_ACTIVE_ORGANIZATION',
  });
  await assert.rejects(call(stubAuth({ session: false })), { code: 'UNAUTHORIZED' });
});

test("with the app's Better Auth, a suspended membership loses its organization", async () => {
  // The app's own instance with its memory adapter and the declared member field `disabled`.
  const { auth } = await import('../src/server/auth.ts');
  const signedUp = await auth.api.signUpEmail({
    body: { name: 'Carol (test)', email: 'carol@example.test', password: 'carol-test-password' },
    returnHeaders: true,
  });
  const cookie = signedUp.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const headers = new Headers({ cookie });
  // Creating an organization makes it the session's active one, with Carol as its owner.
  const organization = await auth.api.createOrganization({
    body: { name: 'Carol test team', slug: 'carol-test-team' },
    headers,
  });
  const context = createRequestContext(auth);
  const resolve = () =>
    context.resolve(new Request('http://127.0.0.1:3103/api/rpc/x', { headers }));
  const owner = await resolve();
  assert.equal(owner.organization.id, organization.id);
  assert.equal(owner.member.role, 'owner');
  const { adapter } = await auth.$context;
  await adapter.update({
    model: 'member',
    where: [{ field: 'id', value: owner.member.id }],
    update: { disabled: true },
  });
  assert.deepEqual(await resolve(), {
    user: owner.user,
    organization: null,
    reason: 'NOT_A_MEMBER',
  });
  assert.deepEqual(await context.resolve(new Request('http://127.0.0.1:3103/api/rpc/x')), {
    user: null,
  });
});
