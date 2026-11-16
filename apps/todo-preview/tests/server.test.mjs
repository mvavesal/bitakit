import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fetchHandler } from '@bitakit/core/server';
import { identity, mountServer } from '@bitakit/core/testing';

// The server half of todos, booted once; as() calls it as different people. The store lives on
// globalThis, so every test works in organizations of its own.
const mounted = await mountServer('src/plugins/todos');
after(() => mounted.stop());

const member = (organization, user = 'user-1') => mounted.as(identity({ user, organization }));
const operations = ['add', 'clear', 'complete', 'edit', 'list', 'remove'];

test('the six operations are exposed to members of an organization', async () => {
  const listed = await mounted.server.operations();
  assert.deepEqual(
    listed.map(({ id, access, exposed }) => [id, access, exposed]),
    operations.map((name) => [`todos.${name}`, 'organization', true]),
  );
});

test('a member adds, edits, completes, removes and clears tasks of their organization', async () => {
  const alice = member('org-crud');
  assert.deepEqual(await alice.todos.list(), { items: [] });
  const {
    items: [first],
  } = await alice.todos.add({ title: '  Port the route  ' });
  assert.deepEqual(first, { id: first.id, title: 'Port the route', completed: false });
  const { items } = await alice.todos.add({ title: 'Write the tests' });
  assert.deepEqual(
    items.map((item) => item.title),
    ['Port the route', 'Write the tests'],
  );
  assert.equal(
    (await alice.todos.edit({ id: first.id, title: 'Port the tasks route' })).items[0].title,
    'Port the tasks route',
  );
  assert.equal(
    (await alice.todos.complete({ id: first.id, completed: true })).items[0].completed,
    true,
  );
  assert.deepEqual(
    (await alice.todos.remove({ id: first.id })).items.map((item) => item.title),
    ['Write the tests'],
  );
  // Another member of the same organization shares its tasks.
  assert.equal((await member('org-crud', 'user-2').todos.list()).items.length, 1);
  assert.deepEqual(await alice.todos.clear({ organizationId: 'org-crud' }), { items: [] });
  assert.deepEqual(await alice.todos.list(), { items: [] });
});

test('a member of another organization neither sees nor changes these tasks', async () => {
  const alice = member('org-a');
  const {
    items: [task],
  } = await alice.todos.add({ title: 'Only in A' });
  const bob = member('org-b', 'user-2');
  assert.deepEqual(await bob.todos.list(), { items: [] });
  const notFound = { code: 'NOT_FOUND', message: 'Task not found in this organization.' };
  await assert.rejects(bob.todos.edit({ id: task.id, title: 'Taken' }), notFound);
  await assert.rejects(bob.todos.complete({ id: task.id, completed: true }), notFound);
  await assert.rejects(bob.todos.remove({ id: task.id }), notFound);
  await bob.todos.clear({ organizationId: 'org-b' });
  assert.deepEqual((await alice.todos.list()).items, [task]);
});

test('a signed-out caller is refused by every operation', async () => {
  const anonymous = mounted.as(identity({ user: null }));
  const inputs = {
    add: { title: 'x' },
    clear: { organizationId: 'org-a' },
    complete: { id: 'x', completed: true },
    edit: { id: 'x', title: 'x' },
    list: undefined,
    remove: { id: 'x' },
  };
  for (const name of operations)
    await assert.rejects(anonymous.todos[name](inputs[name]), { code: 'UNAUTHORIZED' }, name);
});

test('a signed-in caller without an active, enabled membership is refused', async () => {
  await assert.rejects(mounted.as(identity()).todos.list(), {
    code: 'FORBIDDEN',
    reason: 'NO_ACTIVE_ORGANIZATION',
  });
  await assert.rejects(mounted.as(identity({ reason: 'NOT_A_MEMBER' })).todos.list(), {
    code: 'FORBIDDEN',
    reason: 'NOT_A_MEMBER',
  });
});

test('a page loaded for another organization than the session is a conflict', async () => {
  const inA = member('org-stale-a');
  await inA.todos.add({ title: 'Keep me' });
  // The session moved to org-stale-b in another tab; this page still shows org-stale-a.
  const inB = member('org-stale-b');
  await inB.todos.add({ title: 'Keep me too' });
  await assert.rejects(inB.todos.add({ title: 'Stale' }, { organizationId: 'org-stale-a' }), {
    code: 'CONFLICT',
    reason: 'ORGANIZATION_CHANGED',
  });
  // Clear names the organization the person confirmed, also without the organization header.
  await assert.rejects(inB.todos.clear({ organizationId: 'org-stale-a' }), {
    code: 'CONFLICT',
    message: 'The selected organization changed. Try again.',
  });
  assert.deepEqual(
    (await inB.todos.list()).items.map((item) => item.title),
    ['Keep me too'],
  );
  assert.equal((await inA.todos.list()).items.length, 1);
});

test('invalid input is a bad request that names the field', async () => {
  const alice = member('org-invalid');
  const field = async (call, path) => {
    const error = await call.then(
      () => assert.fail('accepted invalid input'),
      (error) => error,
    );
    assert.equal(error.code, 'BAD_REQUEST');
    assert.deepEqual(
      error.issues.map((issue) => issue.path),
      [path],
    );
  };
  await field(alice.todos.add({ title: '   ' }), ['title']);
  await field(alice.todos.add({}), ['title']);
  await field(alice.todos.edit({ id: 7, title: 'x' }), ['id']);
  await field(alice.todos.complete({ id: 'x', completed: 'yes' }), ['completed']);
  await field(alice.todos.clear({}), ['organizationId']);
  assert.deepEqual(await alice.todos.list(), { items: [] });
});

test('an operation without input refuses a body', async () => {
  await assert.rejects(member('org-invalid').todos.list({ organizationId: 'org-invalid' }), {
    code: 'BAD_REQUEST',
    message: 'This operation takes no input.',
  });
});

test('over HTTP a signed-out call answers 401 with the error envelope', async () => {
  const handle = fetchHandler(mounted.server);
  const response = await handle(
    new Request('http://127.0.0.1:3103/api/rpc/todos.clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-a' }),
    }),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' },
  });
});
