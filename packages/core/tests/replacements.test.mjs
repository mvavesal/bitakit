import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import {
  FoundationRuntime,
  defineAction,
  defineFormAction,
  resolveContribution,
} from '../dist/core.js';
const original = defineAction({
  id: 'plugin.example',
  title: 'Original',
  groups: ['menu'],
  execute: () => {
    throw new Error('Original must not run');
  },
});
const plugin = { id: 'plugin', actions: [original] };
test('discovered app replacement retains target ID, placements, behavior and cleanup', async () => {
  let runs = 0;
  const replacement = resolveContribution(
    defineAction({
      replaces: 'plugin.example',
      title: 'Custom',
      execute: () => {
        runs++;
      },
    }),
    'app.override',
  );
  assert.equal(replacement.id, 'plugin.example');
  const list = createActionList();
  const runtime = new FoundationRuntime(list, { plugins: [plugin], actions: [replacement] });
  const dispose = runtime.mount();
  assert.equal(list.get('plugin.example').title, 'Custom');
  assert.equal(list.get('plugin.example').groups[0].id, 'menu');
  await list.execute('plugin.example');
  assert.equal(runs, 1);
  assert.equal(list.get('app.override'), undefined);
  dispose();
  assert.equal(list.get('plugin.example'), undefined);
});
test('conflicts and missing or plugin-owned replacements fail explicitly', () => {
  const replace = defineAction({ replaces: 'plugin.example' });
  const mount = (plugins, actions) =>
    new FoundationRuntime(createActionList(), { plugins, actions }).mount();
  assert.throws(() => mount([], [replace]), /missing plugin action/);
  assert.throws(() => mount([plugin], [replace, replace]), /Multiple app replacements/);
  assert.throws(
    () => mount([plugin, { id: 'other', actions: [original] }], [replace]),
    /Duplicate plugin action/,
  );
  assert.throws(() => mount([{ id: 'other', actions: [replace] }], []), /Only app actions/);
  assert.throws(
    () => mount([plugin], [defineAction({ id: 'plugin.example' })]),
    /already|Duplicate|registered/i,
  );
  assert.throws(
    () => resolveContribution(defineAction({ id: 'wrong', replaces: 'plugin.example' })),
    /retain/,
  );
});
test('form replacement registers only the replacement submit action', async () => {
  let submitted = false;
  const replacement = defineFormAction({
    replaces: 'plugin.example',
    fields: { email: { type: 'email' } },
    submit: () => {
      submitted = true;
    },
  });
  const list = createActionList();
  const runtime = new FoundationRuntime(list, { plugins: [plugin], actions: [replacement] });
  const dispose = runtime.mount();
  await list.execute('plugin.example');
  await list.execute('plugin.example.submit', { email: 'a@example.test' });
  assert.equal(submitted, true);
  dispose();
  assert.equal(list.get('plugin.example.submit'), undefined);
});
