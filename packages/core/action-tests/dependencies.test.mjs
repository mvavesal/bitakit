import test from 'node:test';
import assert from 'node:assert/strict';
import { Action, createActionList } from '../dist/actions/core.js';

test('transitive dependencies react to registration, removal and updates without changing own enabled', async () => {
  let runs = 0;
  const own = new Action({
    title: 'Own',
    dependsOn: ['middle'],
    execute: () => {
      runs++;
    },
  });
  const list = createActionList([{ id: 'other', title: 'Other' }]);
  list.add('own', own);
  const other = list.get('other');
  assert.equal(list.get('own').enabled, false);
  assert.equal(own.enabled, true);
  const middle = list.register({
    id: 'middle',
    title: 'Middle',
    dependsOn: ['permission'],
  });
  const permission = list.register({ id: 'permission', title: 'Permission' });
  assert.equal(list.get('own').enabled, true);
  own.enabled = false;
  list.update('permission', { enabled: false });
  list.update('permission', { enabled: true });
  assert.equal(list.get('own').enabled, false);
  own.enabled = true;
  await list.execute('own');
  assert.equal(runs, 1);
  permission.unregister();
  assert.deepEqual(await list.execute('own'), {
    status: 'skipped',
    reason: 'disabled',
  });
  assert.equal(own.enabled, true);
  assert.equal(list.get('other'), other);
  middle.unregister();
});

test('cycles fail closed and recover when broken; dependency lists are immutable snapshots', () => {
  const ids = ['b'];
  const list = createActionList([
    { id: 'a', title: 'A', dependsOn: ids },
    { id: 'b', title: 'B', dependsOn: ['a'] },
    { id: 'c', title: 'C', dependsOn: ['a'] },
  ]);
  ids.length = 0;
  for (const id of ['a', 'b', 'c']) {
    assert.equal(list.get(id).enabled, false);
    assert.equal(list.resolve(id).enabled, false);
  }
  list.update('b', { dependsOn: [] });
  for (const id of ['a', 'b', 'c']) assert.equal(list.get(id).enabled, true);
  list.update('b', { dependsOn: ['b'] });
  assert.equal(list.resolve('c').enabled, false);
  list.update('b', { dependsOn: undefined });
  assert.equal(list.resolve('c').enabled, true);
});

test('contextual guards are evaluated transitively without executing prerequisites and rechecked after interception', async () => {
  let allow,
    calls = 0,
    dependencyCalls = 0;
  const list = createActionList([
    {
      id: 'permission',
      title: 'Permission',
      resolve: (input) => ({ enabled: input?.allowed === true }),
      execute: () => {
        dependencyCalls++;
      },
    },
    { id: 'middle', title: 'Middle', dependsOn: ['permission'] },
    {
      id: 'run',
      title: 'Run',
      dependsOn: ['middle'],
      execute: () => {
        calls++;
      },
    },
  ]);
  assert.equal(list.get('run').enabled, false);
  assert.equal(list.resolve('run', { allowed: true }).enabled, true);
  assert.equal(list.resolve('run', { allowed: false }).enabled, false);
  const remove = list.use({
    before: () =>
      new Promise((resolve) => {
        allow = resolve;
      }),
  });
  const running = list.execute('run', { allowed: true });
  list.update('permission', { enabled: false });
  allow(true);
  assert.deepEqual(await running, { status: 'skipped', reason: 'disabled' });
  remove();
  list.update('permission', { enabled: true });
  await list.execute('run', { allowed: true });
  assert.equal(calls, 1);
  assert.equal(dependencyCalls, 0);
});

test('text projection keeps original class values, translates derived presentation and refreshes in place', () => {
  let messages = { 'save.title': 'Save', 'save.description': 'Save changes' };
  const project = (action) => ({
    title: messages[action.title] ?? action.title,
    description: messages[action.description] ?? action.description,
  });
  const list = createActionList([], { project });
  const action = new Action({
    title: 'save.title',
    description: 'save.description',
  });
  list.add('save', action);
  assert.equal(list.get('save').title, 'Save');
  assert.equal(action.title, 'save.title');
  messages = {
    'save.title': 'Speichern',
    'save.description': 'Änderungen speichern',
  };
  list.refresh();
  assert.equal(list.resolve('save').description, 'Änderungen speichern');
  assert.equal(action.description, 'save.description');
  action.title = 'Literal text';
  assert.equal(list.get('save').title, 'Literal text');
});
