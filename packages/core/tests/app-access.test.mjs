import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationRuntime,
  FoundationServiceError,
  createActionList,
  serviceKey,
  provideService,
  defineAction,
  resolveActionId,
} from '../dist/core.js';

test('Action references preserve guards, current state, ownership and internal exclusion', async () => {
  let calls = 0;
  const list = createActionList();
  const runtime = new FoundationRuntime(list, { actions: [defineAction({ id: 'documents.create',
    enabled: false, execute: () => ++calls })] });
  const reference = runtime.app.actions.documents.create;
  assert.equal(resolveActionId(reference, list), 'documents.create');
  assert.throws(() => resolveActionId(reference, createActionList()), /different Foundation instance/);
  const stop = runtime.mount();
  try {
    assert.deepEqual(await reference.execute(), { status: 'skipped', reason: 'disabled' });
    assert.equal(calls, 0);
    list.update('documents.create', { enabled: true });
    assert.equal((await reference.execute()).value, 1);
    list.register({ id: 'documents.private', internal: true, execute: () => ++calls });
    assert.deepEqual(Object.keys(runtime.app.actions.documents), ['create']);
    assert.throws(() => runtime.app.actions.documents.private.execute(), /Internal Action/);
  } finally { stop(); }
});

test('public app access reuses instances and fails clearly before mount and after disposal', () => {
  const key = serviceKey('editor.documents');
  const documents = { open: () => 'document' };
  let disposed = 0;
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      {
        id: 'editor',
        publicServices: { documents: key },
        services: [provideService(key, { create: () => documents, dispose: () => disposed++ })],
      },
    ],
  });
  const app = runtime.app;
  assert.equal(app.optional.services.documents, undefined);
  assert.throws(
    () => app.services.documents,
    (error) => error instanceof FoundationServiceError && error.reason === 'not-ready',
  );
  const stop = runtime.mount();
  assert.equal(app.services.documents, documents);
  assert.equal(app.optional.services.documents, documents);
  assert.equal(runtime.services[key], documents);
  assert.equal(app.actions.documents.create.id, 'documents.create');
  assert.equal(app.config['@foundation/app'], runtime.configuration.plugin('@foundation/app').snapshot());
  stop();
  assert.equal(disposed, 1);
  assert.equal(app.ready, false);
  assert.equal(app.optional.services.documents, undefined);
  assert.throws(() => app.services.documents, /Foundation service "documents" is unavailable/);
});

test('missing and unregistered public services report known ownership only', () => {
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [{ id: 'editor', publicServices: { documents: serviceKey('missing') } }],
  });
  const stop = runtime.mount();
  try {
    assert.throws(
      () => runtime.app.services.documents,
      (error) => error.reason === 'missing' && error.plugin === 'editor',
    );
    assert.throws(
      () => runtime.app.services.unknown,
      (error) => error.reason === 'unregistered' && error.plugin === undefined,
    );
    assert.equal(runtime.app.optional.services.unknown, undefined);
    assert.equal(runtime.app.then, undefined);
  } finally {
    stop();
  }
});

test('public names reject collisions without constructing services', () => {
  const key = serviceKey('documents');
  for (const publicServices of [{ then: key }, { toJSON: key }]) {
    assert.throws(
      () => new FoundationRuntime(createActionList(), { publicServices }),
      /uses a reserved segment/,
    );
  }
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        plugins: [
          { id: 'one', publicServices: { documents: key } },
          { id: 'two', publicServices: { documents: key } },
        ],
      }),
    /Plugins "one" and "two" both expose a service named "documents"/,
  );
});
