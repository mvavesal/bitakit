import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serviceKey,
  provideService,
  getService,
  FoundationRuntime,
  createActionList,
  definePlugin,
} from '../dist/core.js';

test('typed keys use the shared plugin container with dependency order and reverse cleanup', () => {
  const base = serviceKey('base');
  const derived = serviceKey('derived');
  const stopped = [];
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      definePlugin({
        id: 'services',
        services: [
          provideService(derived, {
            requires: [base],
            create: ({ services }) => getService(services, base) + 1,
            dispose: () => stopped.push('derived'),
          }),
          provideService(base, { create: () => 4, dispose: () => stopped.push('base') }),
        ],
      }),
    ],
  });
  const stop = runtime.mount();
  assert.equal(getService(runtime.services, derived), 5);
  assert.throws(() => getService(runtime.services, serviceKey('missing')), /Missing service/);
  stop();
  assert.deepEqual(stopped, ['derived', 'base']);
});

test('empty keys and duplicate providers fail before execution', () => {
  assert.throws(() => serviceKey('  '), /must not be empty/);
  const key = serviceKey('same');
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      {
        id: 'duplicate',
        services: [
          provideService(key, { create: () => 1 }),
          provideService(key, { create: () => 2 }),
        ],
      },
    ],
  });
  assert.throws(() => runtime.mount(), /Duplicate service/);
});

test('form submission receives the original opening input for tenant checks', async () => {
  const { defineFormAction } = await import('../dist/core.js');
  let received;
  const action = defineFormAction({ id: 'scope.form', fields: { name: { type: 'text' } }, submit: (_values, context) => { received = context.input; }, success: false });
  const list = createActionList();
  const runtime = new FoundationRuntime(list, { actions: [action] });
  const stop = runtime.mount();
  await list.execute('scope.form', 'original-organization');
  await list.execute('scope.form.submit', { name: 'Example' });
  assert.equal(received, 'original-organization');
  stop();
});
