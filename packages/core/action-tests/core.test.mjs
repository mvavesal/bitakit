import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '../dist/actions/core.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

test('registration, lookup, shared subscription updates and unrelated identity', () => {
  const list = createActionList([{ id: 'other', title: 'Other' }]);
  assert.equal(list.get('toString'), undefined);
  const other = list.get('other');
  const reg = list.register({ id: 'course.save', title: 'Save' });
  assert.throws(
    () => list.register({ id: 'course.save', title: 'Duplicate' }),
    /already registered/,
  );
  assert.throws(() => list.register({ id: '', title: 'Invalid' }));
  let left, right;
  const stopLeft = list.subscribe(() => {
    left = list.get('course.save');
  });
  const stopRight = list.subscribe(() => {
    right = list.get('course.save');
  });
  function Icon() {
    return null;
  }
  reg.update({ title: 'Publish', enabled: false, checked: true, href: '/publish', icon: Icon });
  assert.equal(left, right);
  assert.equal(left.title, 'Publish');
  assert.equal(left.icon, Icon);
  assert.equal(left.href, '/publish');
  assert.equal(left.checked, true);
  assert.equal(left.enabled, false);
  assert.equal(list.get('other'), other);
  stopLeft();
  stopRight();
  reg.unregister();
  assert.equal(list.get('course.save'), undefined);
});

test('execution uses latest handler and checks enabled/visible at invocation', async () => {
  const calls = [];
  const list = createActionList([
    {
      id: 'run',
      title: 'Run',
      execute: () => {
        calls.push('old');
      },
    },
  ]);
  const invoke = () => list.execute('run');
  list.update('run', {
    execute: () => {
      calls.push('new');
    },
    enabled: false,
  });
  assert.deepEqual(await invoke(), { status: 'skipped', reason: 'disabled' });
  list.update('run', { enabled: true, visible: false });
  assert.deepEqual(await invoke(), { status: 'skipped', reason: 'hidden' });
  list.update('run', { visible: true });
  assert.deepEqual(await invoke(), { status: 'completed', value: undefined });
  assert.deepEqual(calls, ['new']);
  assert.equal(list.get('run').pending, false);
  assert.deepEqual(await list.execute('missing'), { status: 'skipped', reason: 'missing' });
  list.update('run', { execute: undefined });
  assert.deepEqual(await invoke(), { status: 'skipped', reason: 'no-handler' });
});

test('async execution shares pending, skips repeated calls and preserves edits', async () => {
  const job = deferred();
  let calls = 0;
  const list = createActionList([
    {
      id: 'run',
      title: 'Run',
      execute: () => {
        calls++;
        return job.promise;
      },
    },
  ]);
  const first = list.execute('run');
  assert.equal(list.get('run').pending, true);
  assert.deepEqual(await list.execute('run'), { status: 'skipped', reason: 'pending' });
  list.update('run', { title: 'Renamed while running', checked: true });
  job.resolve();
  await first;
  assert.equal(calls, 1);
  assert.equal(list.get('run').pending, false);
  assert.equal(list.get('run').title, 'Renamed while running');
  assert.equal(list.get('run').checked, true);
});

test('sync and async errors reach the caller and clear pending', async () => {
  const failure = new Error('Expected failure');
  const list = createActionList([
    {
      id: 'run',
      title: 'Run',
      execute: () => {
        throw failure;
      },
    },
  ]);
  await assert.rejects(list.execute('run'), (e) => e === failure);
  assert.equal(list.get('run').pending, false);
  list.update('run', {
    execute: async () => {
      throw failure;
    },
  });
  await assert.rejects(list.execute('run'), (e) => e === failure);
  assert.equal(list.get('run').pending, false);
});

test('stale cleanup, update, and completion cannot affect replacement registration', async () => {
  const firstJob = deferred(),
    secondJob = deferred();
  let oldContext;
  const list = createActionList();
  const old = list.register({
    id: 'run',
    title: 'Old',
    execute: (context) => {
      oldContext = context;
      return firstJob.promise;
    },
  });
  const firstRun = list.execute('run');
  assert.equal(oldContext.get(), list.get('run'));
  old.unregister();
  assert.equal(oldContext.get(), undefined);
  const replacement = list.register({ id: 'run', title: 'New', execute: () => secondJob.promise });
  const secondRun = list.execute('run');
  old.unregister();
  assert.equal(old.update({ title: 'Stale' }), false);
  assert.equal(oldContext.update({ title: 'Stale async edit' }), false);
  firstJob.resolve();
  await firstRun;
  assert.equal(list.get('run').title, 'New');
  assert.equal(list.get('run').pending, true);
  secondJob.resolve();
  await secondRun;
  assert.equal(list.get('run').pending, false);
  replacement.unregister();
});

test('scoped handler updates work and separate lists never share data', async () => {
  const definition = {
    id: 'toggle',
    title: 'Toggle',
    checked: false,
    execute: ({ update }) => {
      update({ checked: true });
    },
  };
  const a = createActionList([definition]),
    b = createActionList([definition]);
  await a.execute('toggle');
  assert.equal(a.get('toggle').checked, true);
  assert.equal(b.get('toggle').checked, false);
});

test('dispose is idempotent, notifies subscribers, and invalidates running registrations', async () => {
  const job = deferred();
  let context,
    notifications = 0;
  const list = createActionList([
    {
      id: 'run',
      title: 'Run',
      execute: (ctx) => {
        context = ctx;
        return job.promise;
      },
    },
  ]);
  const run = list.execute('run');
  const unsubscribe = list.subscribe(() => {
    notifications++;
  });
  list.dispose();
  list.dispose();
  assert.equal(notifications, 1);
  assert.equal(list.get('run'), undefined);
  assert.equal(context.update({ title: 'Late' }), false);
  assert.throws(() => list.register({ id: 'new', title: 'New' }), /disposed/);
  job.resolve();
  await run;
  assert.equal(list.get('run'), undefined);
  unsubscribe();
});

test('host validation is atomic and environment is scoped to a list', async () => {
  const environment = { calls: 0 };
  const list = createActionList([], {
    environment,
    validate(action) {
      if (!action.title) throw new Error('Missing title');
    },
  });
  assert.throws(() => list.register({ id: 'test', title: '' }), /Missing title/);
  const registration = list.register({
    id: 'test',
    title: 'Valid',
    execute(context) {
      assert.equal(context.environment, environment);
      environment.calls++;
    },
  });
  assert.throws(() => registration.update({ title: '' }), /Missing title/);
  assert.equal(list.get('test').title, 'Valid');
  await list.execute('test');
  assert.equal(environment.calls, 1);
  // The hydration snapshot includes registrations made before its first read.
  const initial = list.getInitialState();
  assert.equal(initial.actions.test.title, 'Valid');
  list.update('test', { title: 'Changed' });
  assert.equal(list.getInitialState(), initial);
  assert.equal(initial.actions.test.title, 'Valid');
});

test('execution input belongs to one invocation and is not persisted in shared state', async () => {
  const received = [];
  const list = createActionList([
    {
      id: 'set',
      title: 'Set',
      execute: ({ input }) => {
        received.push(input);
      },
    },
  ]);
  await list.execute('set', 'dark');
  await list.execute('set', 'system');
  await list.execute('set');
  assert.deepEqual(received, ['dark', 'system', undefined]);
  assert.equal(Object.hasOwn(list.get('set'), 'input'), false);
  list.update('set', { enabled: false });
  assert.equal((await list.execute('set', 'light')).status, 'skipped');
  assert.equal(received.length, 3);
});
