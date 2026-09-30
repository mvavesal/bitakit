import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList, ActionGroup } from '../dist/actions/core.js';
test('shared placements are reference-counted and stale cleanup cannot touch replacement', () => {
  const list = createActionList();
  const group = new ActionGroup('menu');
  const original = list.register({ id: 'a', title: 'A' });
  const one = list.attach('a', group),
    two = list.attach('a', group);
  one();
  assert.equal(list.get('a').groups.length, 1);
  two();
  assert.equal(list.get('a').groups.length, 0);
  const stale = list.attach('a', group);
  original.unregister();
  list.register({ id: 'a', title: 'Replacement' });
  const fresh = list.attach('a', group);
  stale();
  assert.equal(list.get('a').groups.length, 1);
  fresh();
  assert.equal(list.get('a').groups.length, 0);
});
test('attaching an existing declared placement never removes it', () => {
  const group = new ActionGroup('menu');
  const list = createActionList([{ id: 'a', title: 'A', groups: [group] }]);
  list.attach('a', group)();
  assert.equal(list.get('a').groups.length, 1);
});
