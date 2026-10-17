import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BitaKitServiceError,
  createActionList,
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  resolveActionId,
} from '../dist/core.js';

test('Action references preserve guards, current state, ownership and internal exclusion', async () => {
  let calls = 0;
  const list = createActionList();
  const runtime = createRuntime(
    { actions: { 'documents.create': defineAction({ enabled: false, execute: () => ++calls }) } },
    { actions: list },
  );
  const reference = runtime.app.actions.documents.create;
  assert.equal(resolveActionId(reference, list), 'documents.create');
  assert.throws(
    () => resolveActionId(reference, createActionList()),
    /different BitaKit instance/,
  );
  const stop = runtime.mount();
  try {
    assert.deepEqual(await reference.execute(), { status: 'skipped', reason: 'disabled' });
    assert.equal(calls, 0);
    list.update('documents.create', { enabled: true });
    assert.equal((await reference.execute()).value, 1);
    list.register({
      id: 'documents.private',
      title: 'Private',
      internal: true,
      execute: () => ++calls,
    });
    assert.deepEqual(Object.keys(runtime.app.actions.documents), ['create']);
    assert.throws(() => runtime.app.actions.documents.private.execute(), /Internal Action/);
  } finally {
    await stop();
  }
});

test('public app access reuses instances and fails clearly before mount and after disposal', async () => {
  const documents = { open: () => 'document' };
  let stopped = 0;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'editor',
        services: {
          documents: defineService(
            ({ onStop }) => {
              onStop(() => stopped++);
              return documents;
            },
            { exposeAs: 'documents' },
          ),
        },
        actions: { create: defineAction({ id: 'documents.create', execute() {} }) },
      }),
    ],
  });
  const app = runtime.app;
  assert.equal(app.optional, undefined, 'app.optional is gone');
  assert.throws(
    () => app.services.documents,
    (error) => error instanceof BitaKitServiceError && error.reason === 'not-ready',
  );
  assert.equal(app.ready, false);
  const stop = runtime.mount();
  assert.equal(app.ready, true);
  assert.equal(app.services.documents, documents);
  assert.equal(app.services.editor.documents, documents);
  assert.equal(runtime.services.documents, documents);
  assert.equal(app.actions.documents.create.id, 'documents.create');
  assert.equal(app.config.app, runtime.configuration.plugin('app').snapshot());
  assert.deepEqual(app.config.editor, {});
  assert.equal(Object.isFrozen(app), true);
  await stop();
  assert.equal(stopped, 1);
  assert.equal(app.ready, false);
  assert.throws(() => app.services.documents, /BitaKit service "documents" is unavailable/);
});

test('unknown services report a structured error; reserved lookups stay undefined', async () => {
  const runtime = createRuntime({ plugins: [definePlugin({ id: 'editor' })] });
  const stop = runtime.mount();
  try {
    assert.throws(
      () => runtime.app.services.unknown,
      (error) =>
        error instanceof BitaKitServiceError &&
        error.code === 'BITAKIT_SERVICE_UNAVAILABLE' &&
        error.reason === 'unregistered' &&
        error.plugin === undefined,
    );
    assert.equal(runtime.app.then, undefined);
    assert.equal(runtime.app.services.then, undefined);
    assert.equal(runtime.app.services.toJSON, undefined);
    assert.equal('unknown' in runtime.app.services, false);
    assert.deepEqual(Object.keys(runtime.app.services), []);
  } finally {
    await stop();
  }
  assert.deepEqual(Object.keys(runtime.app.services), [], 'not mounted: nothing to enumerate');
});
