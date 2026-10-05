import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, defineAction, defineSlot } from '../dist/core.js';

const slots = {
  navigation: defineSlot({ accepts: 'actions' }),
  menu: defineSlot({ accepts: 'actions' }),
};
test('placements reference one public Action; groups do not select UI and cleanup removes references', async () => {
  let calls = 0;
  const map = ({ payload }) => {
    calls++;
    return payload.member;
  };
  const runtime = createRuntime({
    slots,
    actions: {
      open: defineAction({
        groups: ['search'],
        slots: ['navigation', { name: 'menu', input: map }],
        execute() {},
      }),
      unplaced: defineAction({ groups: ['navigation'], execute() {} }),
      secret: defineAction({ internal: true, slots: ['navigation'], execute() {} }),
    },
  });
  const stop = runtime.mount();
  await runtime.ready;
  assert.equal(calls, 0, 'input mapping belongs to outlets, not installation');
  assert.deepEqual(
    runtime.slots.get('navigation').items.map((x) => x.actionId),
    ['open'],
  );
  const item = runtime.slots.get('menu').items[0];
  assert.equal(item.input({ payload: { member: 'ada' } }), 'ada');
  assert.equal(
    Object.keys(runtime.actions.getState().actions).filter((id) => id === 'open').length,
    1,
  );
  runtime.actions.update('open', { title: 'Updated', groups: [] });
  assert.equal(runtime.slots.get('navigation').items.length, 1);
  await stop();
  assert.equal(runtime.slots.get('navigation').items.length, 0);
  assert.equal(runtime.actions.get('open'), undefined);
});

test('invalid or duplicate placements fail with attribution and release partial registrations', async () => {
  for (const placements of [
    ['navigation', 'typo'],
    ['navigation', 'navigation'],
  ]) {
    const runtime = createRuntime({
      slots,
      plugins: [
        {
          id: 'broken',
          actions: {
            open: defineAction({ slots: placements, execute() {} }),
          },
        },
      ],
    });
    try {
      runtime.mount();
    } catch {
      /* synchronous attributed startup failure */
    }
    await assert.rejects(runtime.ready, { name: 'FoundationStartupError', plugin: 'broken' });
    await runtime.stop();
    assert.equal(runtime.actions.get('broken.open'), undefined);
    assert.equal(runtime.slots.get('navigation').items.length, 0);
  }
});
