import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionStatus, FoundationRuntime, createActionList, defineAction } from '../dist/core.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('instance-style commands share observable state across calls and isolate registrations', async () => {
  const definition = defineAction()({
    id: 'save',
    initialState: { count: 0, title: '' },
    execute(input) {
      this.state.update((current) => ({ count: current.count + 1, title: input.title }));
      return this.state.get().title;
    },
  });
  const one = new FoundationRuntime(createActionList(), { actions: [definition] });
  const two = new FoundationRuntime(createActionList(), { actions: [definition] });
  const stopOne = one.mount(),
    stopTwo = two.mount();
  const seen = [];
  const unsubscribe = one.actions.subscribe(() => seen.push(one.actions.get('save')?.status));
  try {
    assert.equal(one.actions.get('save').status, ActionStatus.Idle);
    assert.equal((await one.app.actions.save.execute({ title: 'First' })).value, 'First');
    await one.app.actions.save.execute({ title: 'Second' });
    assert.deepEqual(one.actions.get('save').state, { count: 2, title: 'Second' });
    assert.deepEqual(two.actions.get('save').state, { count: 0, title: '' });
    assert.equal(one.actions.get('save').status, ActionStatus.Succeeded);
    assert.ok(seen.includes(ActionStatus.Pending));
    assert.ok(seen.includes(ActionStatus.Succeeded));
  } finally {
    unsubscribe();
    stopOne();
    stopTwo();
  }
});

test('failure, skipped calls and replacement preserve lifecycle and ownership', async () => {
  const gate = deferred();
  let lateUpdate;
  const definition = defineAction()({
    id: 'save',
    initialState: { count: 0 },
    async execute(input) {
      if (input.fail) throw new Error('Save failed');
      await gate.promise;
      lateUpdate = this.state.update((current) => ({ count: current.count + 1 }));
    },
  });
  const runtime = new FoundationRuntime(createActionList(), { actions: [definition] });
  const stop = runtime.mount();
  await assert.rejects(
    runtime.actions.execute('save', { fail: true }),
    (error) => error.cause?.message === 'Save failed',
  );
  const failed = runtime.actions.get('save');
  assert.equal(failed.status, ActionStatus.Failed);
  assert.ok(failed.error);
  const removeInterceptor = runtime.actions.use({ before: () => false });
  assert.deepEqual(await runtime.actions.execute('save', {}), {
    status: 'skipped',
    reason: 'intercepted',
  });
  assert.equal(runtime.actions.get('save').status, ActionStatus.Failed);
  assert.equal(runtime.actions.get('save').error, failed.error);
  removeInterceptor();
  const running = runtime.actions.execute('save', {});
  assert.deepEqual(await runtime.actions.execute('save', {}), {
    status: 'skipped',
    reason: 'pending',
  });
  stop();
  const replacement = runtime.actions.register({
    id: 'save',
    title: 'Replacement',
    initialState: { count: 100 },
    execute() {},
  });
  gate.resolve();
  await running;
  assert.equal(lateUpdate, false);
  assert.equal(runtime.actions.get('save').status, ActionStatus.Idle);
  assert.deepEqual(runtime.actions.get('save').state, { count: 100 });
  replacement.unregister();
});
