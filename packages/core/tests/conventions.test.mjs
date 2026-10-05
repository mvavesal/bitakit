import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import {
  FoundationRuntime,
  createRuntime,
  defineAction,
  definePlugin,
  fallbackTitle,
  resolveContribution,
} from '../dist/core.js';

const translator = (messages) =>
  Object.assign(
    (key) => {
      assert.ok(Object.hasOwn(messages, key), `a missing key reached the translator: ${key}`);
      return messages[key];
    },
    { has: (key) => Object.hasOwn(messages, key) },
  );

test('IDs come from record keys or discovery paths; explicit IDs win; titles fall back to the last segment', async () => {
  assert.equal(
    resolveContribution(defineAction({ execute() {} }), 'users.invite').id,
    'users.invite',
  );
  assert.equal(
    resolveContribution(defineAction({ id: 'custom.id', execute() {} }), 'ignored').id,
    'custom.id',
  );
  assert.throws(() => resolveContribution(defineAction({ execute() {} })), /needs an ID/);
  assert.throws(() => resolveContribution({ execute() {} }, 'plain'), /Export defineAction/);
  assert.throws(
    () => resolveContribution(defineAction({ id: 'bad id', execute() {} })),
    /Invalid action ID "bad id"/,
  );
  assert.equal(fallbackTitle({ id: 'todos.clear-all' }), 'Clear all');
  assert.equal(fallbackTitle({ id: 'save_draft' }), 'Save draft');
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'users',
        actions: {
          invite: defineAction({ execute() {} }),
          'admin.reset': defineAction({ execute() {} }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.actions.get('users.invite').title, 'Invite');
    assert.equal(runtime.actions.get('users.admin.reset').title, 'Reset');
  } finally {
    await stop();
  }
});

test('title, description and tooltip accept keys or literals, prefer <id>.* catalog keys and follow the locale', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'users',
        actions: {
          save: defineAction({
            title: 'save.title',
            description: 'save.description',
            tooltip: 'Literal tip',
            execute() {},
          }),
          remove: defineAction({ title: 'Remove', execute() {} }),
          archive: defineAction({ execute() {} }),
        },
      }),
    ],
  });
  runtime.setTranslations(
    translator({
      'save.title': 'Save',
      'save.description': 'Save changes',
      'users.remove.title': 'Entfernen',
      'users.archive.title': 'Archivieren',
      'users.archive.description': 'Alles archivieren',
    }),
  );
  const stop = runtime.mount();
  try {
    const get = (id) => runtime.actions.get(`users.${id}`);
    assert.equal(get('save').title, 'Save');
    assert.equal(get('save').description, 'Save changes');
    assert.equal(get('save').tooltip, 'Literal tip');
    assert.equal(get('remove').title, 'Entfernen', 'the <id>.title key wins over a literal');
    assert.equal(get('archive').title, 'Archivieren');
    assert.equal(get('archive').description, 'Alles archivieren');
    runtime.setTranslations(translator({ 'save.title': 'Speichern' }));
    assert.equal(get('save').title, 'Speichern');
    assert.equal(
      get('save').description,
      'save.description',
      'an untranslated key stays visible as given',
    );
    assert.equal(get('remove').title, 'Remove');
    assert.equal(get('archive').title, 'Archive');
    assert.equal(get('archive').description, undefined);
  } finally {
    await stop();
  }
});

test('ID collisions roll back without deleting existing host actions', async () => {
  const list = createActionList([{ id: 'users.invite', title: 'Host' }]);
  const runtime = new FoundationRuntime(list, {
    plugins: [
      definePlugin({
        id: 'users',
        actions: { ping: defineAction({ execute() {} }), invite: defineAction({ execute() {} }) },
      }),
    ],
  });
  assert.throws(() => runtime.mount(), /already registered/);
  await runtime.stopped;
  assert.deepEqual(Object.keys(list.getState().actions), ['users.invite']);
  assert.equal(list.get('users.invite').title, 'Host');
});
