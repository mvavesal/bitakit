import test from 'node:test';
import assert from 'node:assert/strict';
import { betterAuthOrganizations } from '../dist/organizations.js';
const ok = (data) => Promise.resolve({ data, error: null });
function fixture() {
  let active = 'one';
  const calls = [];
  const member = (id) => ({ id, role: 'member', user: { name: id, email: `${id}@example.test` } });
  const api = {
    list: () => ok([{ id: 'one', name: 'One', slug: 'one' }]),
    getFullOrganization: () => ok({ id: active }),
    getActiveMember: () => ok({ role: 'admin' }),
    listMembers: ({ query }) => {
      calls.push(query);
      return ok({ members: [member(String(query.offset))], total: 2 });
    },
    listInvitations: () =>
      ok([{ id: 'invite', email: 'a@example.test', role: 'member', status: 'pending' }]),
    setActive: (input) => {
      active = input.organizationId;
      return ok(null);
    },
    create: () => ok(null),
    inviteMember: (input) => {
      calls.push(input);
      return ok(null);
    },
    cancelInvitation: (input) => {
      calls.push(input);
      return ok(null);
    },
    updateMemberRole: (input) => {
      calls.push(input);
      return ok(null);
    },
    removeMember: (input) => {
      calls.push(input);
      return ok(null);
    },
  };
  return { api, calls, backend: betterAuthOrganizations({ organization: api }) };
}
test('adapter normalizes SDK records, follows pagination and scopes writes', async () => {
  const { backend, calls } = fixture();
  const snapshot = await backend.load();
  assert.equal(snapshot.members.length, 2);
  assert.equal(snapshot.canManage, true);
  assert.deepEqual(
    calls.map((item) => item.offset),
    [0, 1],
  );
  await backend.removeMember({ organizationId: 'one', memberId: 'member' });
  assert.deepEqual(calls.at(-1), { organizationId: 'one', memberIdOrEmail: 'member' });
  await assert.rejects(
    backend.cancelInvitation({ organizationId: 'one', invitationId: 'foreign' }),
    /not in this organization/,
  );
});
test('disabled membership and SDK errors fail closed', async () => {
  const { api, backend } = fixture();
  api.getActiveMember = () => ok({ role: 'owner', disabled: true });
  await assert.rejects(backend.load(), /disabled/);
  api.inviteMember = () => Promise.resolve({ data: null, error: new Error('denied') });
  await assert.rejects(
    backend.invite({ organizationId: 'one', email: 'a@example.test', role: 'member' }),
    /denied/,
  );
});
test('normal members do not request administrative invitation data', async () => {
  const { api, backend } = fixture();
  api.getActiveMember = () => ok({ role: 'member' });
  api.listInvitations = () => {
    throw new Error('must not request');
  };
  const snapshot = await backend.load();
  assert.equal(snapshot.canManage, false);
  assert.deepEqual(snapshot.invitations, []);
});

test('optional operations use explicit server extensions and invitation SDK calls', async () => {
  const { api } = fixture();
  const calls = [];
  api.acceptInvitation = (input) => {
    calls.push(input);
    return ok(null);
  };
  api.rejectInvitation = (input) => {
    calls.push(input);
    return ok(null);
  };
  const backend = betterAuthOrganizations(
    { organization: api },
    {
      setMemberDisabled: async (input) => {
        calls.push(input);
      },
      invite: async (input) => {
        calls.push(input);
      },
    },
  );
  await backend.setMemberDisabled({ organizationId: 'one', memberId: 'target', disabled: true });
  await backend.acceptInvitation('incoming');
  await backend.rejectInvitation('other');
  await backend.invite({
    organizationId: 'one',
    email: 'a@example.test',
    role: 'member',
    resend: true,
    expiresInDays: 14,
  });
  assert.deepEqual(calls[1], { invitationId: 'incoming' });
  assert.equal(calls[3].resend, true);
  assert.equal(calls[3].expiresInDays, 14);
});

test('native organization writes preserve metadata and activate the created organization', async () => {
  const { api, calls } = fixture();
  api.list = () =>
    ok([
      {
        id: 'one',
        name: 'One',
        slug: 'one',
        metadata: JSON.stringify({ website: 'https://example.com', retained: true }),
      },
    ]);
  api.create = (input) => {
    calls.push(input);
    return ok({ id: 'created' });
  };
  api.setActive = (input) => {
    calls.push(input);
    return ok(null);
  };
  api.update = (input) => {
    calls.push(input);
    return ok(null);
  };
  api.delete = (input) => {
    calls.push(input);
    return ok(null);
  };
  const backend = betterAuthOrganizations({ organization: api });
  await backend.create({ name: 'New', slug: 'new', website: 'https://new.example.com' });
  assert.deepEqual(calls.at(-1), { organizationId: 'created' });
  await backend.update({
    organizationId: 'one',
    name: 'One updated',
    slug: 'one',
    website: 'https://new.example.com',
    removeLogo: true,
  });
  assert.equal(calls.at(-1).data.metadata.retained, true);
  assert.equal(calls.at(-1).data.logo, '');
  await backend.delete('one');
  assert.deepEqual(calls.at(-1), { organizationId: 'one' });
});

test('signed-in failures never use demo data and account changes reject stale writes', async () => {
  const { sessionOrganizationBackend } = await import('../dist/organizations.js');
  let session = { data: null, isPending: false, error: null };
  let realWrites = 0;
  let demoWrites = 0;
  const demo = {
    load: async () => ({ activeId: 'demo' }),
    create: async () => {
      demoWrites++;
    },
  };
  const real = {
    load: async () => ({ activeId: 'real' }),
    create: async () => {
      realWrites++;
    },
  };
  const backend = sessionOrganizationBackend(
    { $store: { atoms: { session: { get: () => session, subscribe: () => () => {} } } } },
    real,
    demo,
  );
  assert.equal((await backend.load()).activeId, 'demo');
  session = { ...session, data: { user: { id: 'signed-in' } } };
  await assert.rejects(backend.create({}), /Account changed/);
  assert.equal((await backend.load()).activeId, 'real');
  await backend.create({});
  assert.equal(realWrites, 1);
  assert.equal(demoWrites, 0);
  real.load = async () => {
    throw new Error('server unavailable');
  };
  await assert.rejects(backend.load(), /server unavailable/);
});

test('unverified email only blocks personal invitations, other failures still reject', async () => {
  const { api, backend } = fixture();
  api.listUserInvitations = async () => ({
    data: null,
    error: { code: 'EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION' },
  });
  const data = await backend.load();
  assert.equal(data.activeId, 'one');
  assert.match(data.incomingInvitationsError, /Verify your email address/);
  assert.deepEqual(data.incomingInvitations, []);
  api.listUserInvitations = async () => ({ data: null, error: new Error('network failed') });
  await assert.rejects(backend.load(), /network failed/);
});

test('organization summary requests start together rather than waiting for the list', async () => {
  const { api, backend } = fixture();
  let release;
  let activeStarted = false;
  let invitationsStarted = false;
  api.list = () =>
    new Promise((resolve) => {
      release = () => resolve({ data: [], error: null });
    });
  api.getFullOrganization = () => {
    activeStarted = true;
    return ok(null);
  };
  api.listUserInvitations = () => {
    invitationsStarted = true;
    return ok([]);
  };
  const loading = backend.load();
  assert.equal(activeStarted, true);
  assert.equal(invitationsStarted, true);
  release();
  await loading;
});

test('session fetching flags alone do not clear and reload organizations', async () => {
  const { sessionOrganizationBackend } = await import('../dist/organizations.js');
  let session = {
    data: { user: { id: 'one' } },
    isPending: false,
    error: null,
    isRefetching: false,
  };
  let notify;
  let invalidations = 0;
  const atom = {
    get: () => session,
    subscribe: (listener) => {
      notify = listener;
      return () => {};
    },
  };
  const backend = sessionOrganizationBackend({ $store: { atoms: { session: atom } } }, {}, {});
  backend.subscribe(() => invalidations++);
  session = { ...session, isRefetching: true };
  notify(session);
  assert.equal(invalidations, 0);
  session = { ...session, data: { user: { id: 'two' } } };
  notify(session);
  assert.equal(invalidations, 1);
});

test('native metadata endpoint avoids loading the full organization twice', async () => {
  const { api, backend } = fixture();
  let calls = 0;
  api.getOrganization = () => {
    calls++;
    return ok({ id: 'one' });
  };
  api.getFullOrganization = () => {
    throw new Error('Full organization must not be loaded');
  };
  assert.equal((await backend.load()).activeId, 'one');
  assert.equal(calls, 2);
});

test('outgoing invitation dates are normalized for organization filters', async () => {
  const { api, backend } = fixture();
  api.listInvitations = () =>
    ok([
      {
        id: 'invite',
        email: 'a@example.test',
        role: 'member',
        status: 'pending',
        createdAt: new Date('2026-09-21T10:00:00Z'),
        expiresAt: new Date('2026-10-21T10:00:00Z'),
      },
    ]);
  const { invitations } = await backend.load();
  assert.equal(invitations[0].createdAt, '2026-09-21T10:00:00.000Z');
  assert.equal(invitations[0].createdAt.slice(0, 10), '2026-09-21');
  assert.equal(invitations[0].expiresAt, '2026-10-21T10:00:00.000Z');
});

test('refreshed copies of the same session preserve organization views; tenant changes invalidate', async () => {
  const { sessionOrganizationBackend } = await import('../dist/organizations.js');
  let state = {
    data: {
      user: { id: 'user', emailVerified: true },
      session: { id: 'session', activeOrganizationId: 'one' },
    },
    isPending: false,
    error: null,
  };
  let notify;
  let invalidations = 0;
  const atom = {
    get: () => state,
    subscribe: (listener) => {
      notify = listener;
      return () => {};
    },
  };
  const backend = sessionOrganizationBackend({ $store: { atoms: { session: atom } } }, {}, {});
  backend.subscribe(() => invalidations++);
  state = structuredClone(state);
  notify(state);
  assert.equal(invalidations, 0);
  state = {
    ...state,
    data: { ...state.data, session: { ...state.data.session, activeOrganizationId: 'two' } },
  };
  notify(state);
  assert.equal(invalidations, 1);
});
