import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList, ActionStatus } from '@bitakit/core/actions';
import {
  FoundationRuntime,
  defineAction,
  defineFormAction,
  resolveContribution,
  ActionFailure,
} from '../dist/core.js';

function setup(definition, messages = {}) {
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    groups: ['users.menu'],
    plugins: [{ id: 'users', actions: [definition] }],
  });
  const notifications = [];
  const t = Object.assign(
    (key, values) => {
      assert.ok(Object.hasOwn(messages, key), `Missing key must not reach translator: ${key}`);
      return messages[key].replace('{title}', values?.title ?? '');
    },
    { has: (key) => Object.hasOwn(messages, key) },
  );
  runtime.setTranslations(t);
  runtime.setNotifier((message) => notifications.push(message));
  const cleanup = runtime.mount();
  return { list, runtime, notifications, cleanup };
}

test('IDs, labels and known string placements are inferred; explicit values and opt-outs win', () => {
  const definition = resolveContribution(
    defineFormAction({
      groups: ['users.menu'],
      fields: { email: { type: 'email' } },
      submit() {},
    }),
    'users.invite',
  );
  const { list, runtime, cleanup } = setup(definition, {
    'users.invite.title': 'Einladen',
    'users.invite.fields.email': 'E-Mail-Adresse',
  });
  assert.equal(list.get('users.invite').title, 'Einladen');
  assert.equal(list.get('users.invite').groups[0].id, 'users.menu');
  assert.equal(runtime.fieldLabel(definition, 'email', definition.fields.email), 'E-Mail-Adresse');
  assert.equal(
    runtime.fieldLabel(definition, 'email', { type: 'email', label: 'Custom' }),
    'Custom',
  );
  cleanup();
  const explicit = resolveContribution(
    defineAction({ id: 'custom.id', title: 'Custom' }),
    'ignored',
  );
  assert.equal(explicit.id, 'custom.id');
  assert.equal(explicit.title, 'Custom');
  assert.throws(() => resolveContribution(defineAction({}), 'users.invite', false), /explicit ID/);
  assert.throws(
    () => resolveContribution(defineAction({ id: 'custom' }), undefined, false),
    /explicit title/,
  );
  assert.equal(
    resolveContribution(defineAction({ conventions: true }), 'users.invite', false).id,
    'users.invite',
  );
});

test('shared action title and description accept keys or literal text and update with locale', () => {
  const { list, runtime, cleanup } = setup(
    defineAction({
      id: 'users.save',
      title: 'save.title',
      description: 'save.description',
    }),
    { 'save.title': 'Save', 'save.description': 'Save changes' },
  );
  assert.equal(list.get('users.save').title, 'Save');
  assert.equal(list.get('users.save').description, 'Save changes');
  const messages = { 'save.title': 'Speichern', 'save.description': 'Änderungen speichern' };
  runtime.setTranslations(
    Object.assign((key) => messages[key], { has: (key) => Object.hasOwn(messages, key) }),
  );
  assert.equal(list.get('users.save').title, 'Speichern');
  assert.equal(list.get('users.save').description, 'Änderungen speichern');
  runtime.setTranslations(
    Object.assign(
      () => {
        throw new Error('Do not translate missing keys');
      },
      { has: () => false },
    ),
  );
  assert.equal(list.get('users.save').title, 'save.title');
  assert.equal(list.get('users.save').description, 'save.description');
  cleanup();
});

test('absent feedback is silent even with conventional translations; forms still close', async () => {
  const { list, notifications, cleanup } = setup(
    defineAction({
      id: 'users.refresh',
      execute: () => 42,
    }),
    { 'Foundation.success': '{title}: erledigt' },
  );
  await list.execute('users.refresh');
  assert.deepEqual(notifications, []);
  list.update('users.refresh', { enabled: false });
  await list.execute('users.refresh');
  assert.equal(notifications.length, 0);
  cleanup();
  const form = setup(
    resolveContribution(defineFormAction({ fields: {}, submit() {} }), 'users.invite'),
  );
  await form.list.execute('users.invite');
  assert.deepEqual(form.notifications, []);
  await form.runtime.submitForm(form.runtime.getSnapshot().definition, {});
  assert.deepEqual(form.notifications, []);
  assert.equal(form.runtime.getSnapshot(), null);
  form.cleanup();
});

test('success callback sees service result and input once; pending submissions are guarded', async () => {
  let finish,
    calls = 0;
  const { list, runtime, notifications, cleanup } = setup(
    defineFormAction({
      id: 'users.invite',
      fields: { email: { type: 'email', required: true } },
      async submit() {
        await new Promise((resolve) => {
          finish = resolve;
        });
        return { invitationId: 'created' };
      },
      success({ input, result }) {
        calls++;
        return {
          message: `${result.invitationId}: ${input.email}`,
          closeDialog: false,
        };
      },
    }),
  );
  await list.execute('users.invite');
  const state = runtime.getSnapshot();
  const pending = runtime.submitForm(state.definition, {
    email: 'a@example.com',
  });
  await runtime.submitForm(state.definition, { email: 'a@example.com' });
  assert.equal(calls, 0);
  finish();
  await pending;
  assert.equal(calls, 1);
  assert.deepEqual(notifications, ['created: a@example.com']);
  assert.equal(runtime.getSnapshot(), state);
  cleanup();
});

test('failure callback receives the original error, retains cause and draft, and supports retry', async () => {
  const original = new Error('Private server details');
  let fail = true,
    calls = 0;
  const { list, runtime, cleanup } = setup(
    defineFormAction({
      id: 'users.invite',
      fields: { email: { type: 'email' } },
      submit() {
        if (fail) throw original;
      },
      failure({ error, input }) {
        calls++;
        assert.equal(error, original);
        assert.equal(input.email, 'a@example.com');
        return 'Bitte erneut versuchen.';
      },
      success: false,
    }),
  );
  await list.execute('users.invite');
  const state = runtime.getSnapshot();
  await assert.rejects(
    runtime.submitForm(state.definition, { email: 'a@example.com' }),
    (error) => {
      assert.ok(error instanceof ActionFailure);
      assert.equal(error.feedback, 'Bitte erneut versuchen.');
      assert.equal(error.cause, original);
      return true;
    },
  );
  assert.equal(calls, 1);
  assert.equal(runtime.getSnapshot(), state);
  assert.equal(list.get('users.invite.submit').pending, false);
  fail = false;
  await runtime.submitForm(state.definition, { email: 'a@example.com' });
  assert.equal(runtime.getSnapshot(), null);
  cleanup();
});

test('successful execution reports Succeeded independently of feedback and translation', async () => {
  for (const success of [
    false,
    'Done!',
    { messageKey: 'custom' },
    () => { throw new Error('Broken feedback'); },
  ]) {
    const { list, cleanup } = setup(
      defineAction({ id: 'users.run', execute: () => 42, success }),
      { custom: 'Fertig', 'users.run.success': 'Standard' },
    );
    try {
      assert.equal(list.get('users.run').status, ActionStatus.Idle);
      const result = await list.execute('users.run');
      assert.deepEqual(result, { status: 'completed', value: 42 });
      assert.equal(list.get('users.run').status, ActionStatus.Succeeded);
      assert.equal(list.get('users.run').pending, false);
      assert.equal(list.get('users.run').error, undefined);
    } finally {
      cleanup();
    }
  }
});

test('default errors never display raw errors; explicit false silences failure', async () => {
  for (const failure of [undefined, false]) {
    const { list, cleanup } = setup(
      defineAction({
        id: 'users.fail',
        failure,
        execute() {
          throw new Error('Secret');
        },
      }),
      {
        'Foundation.failure': 'Fehlgeschlagen',
      },
    );
    await assert.rejects(list.execute('users.fail'), (error) => {
      assert.equal(error.feedback, false);
      assert.doesNotMatch(error.message, /Secret/);
      return true;
    });
    cleanup();
  }
});

test('ID collisions roll back without deleting existing host actions', () => {
  for (const action of [defineFormAction({ id: 'users.invite', fields: {}, submit() {} })]) {
    const list = createActionList([{ id: 'users.invite.submit', title: 'Host' }]);
    const runtime = new FoundationRuntime(list, {
      groups: [],
      plugins: [{ id: 'users', actions: [action] }],
    });
    assert.throws(() => runtime.mount(), /already registered/);
    assert.deepEqual(Object.keys(list.getState().actions), ['users.invite.submit']);
  }
});

test('late completion after plugin removal does not run feedback or close a replacement dialog', async () => {
  let finish,
    calls = 0;
  const { list, runtime, notifications, cleanup } = setup(
    defineFormAction({
      id: 'users.invite',
      fields: {},
      async submit() {
        await new Promise((resolve) => {
          finish = resolve;
        });
      },
      success() {
        calls++;
        return 'Done';
      },
    }),
  );
  await list.execute('users.invite');
  const pending = runtime.submitForm(runtime.getSnapshot().definition, {});
  cleanup();
  const again = runtime.mount();
  await list.execute('users.invite');
  const replacement = runtime.getSnapshot();
  finish();
  await pending;
  assert.equal(calls, 0);
  assert.deepEqual(notifications, []);
  assert.equal(runtime.getSnapshot(), replacement);
  again();
});

test('feedback carries the outcome once and notification failures cannot change it', async () => {
  const original = new Error('business failure');
  let fails = false;
  const { list, runtime, cleanup } = setup(
    defineAction({
      id: 'notify',
      success: ({ result }) => `saved:${result}`,
      failure: ({ error }) => (error === original ? 'Try again' : false),
      execute() {
        if (fails) throw original;
        return 7;
      },
    }),
  );
  const received = [];
  const remove = runtime.setNotifier((message, kind) => {
    received.push([kind, message]);
    return Promise.reject(new Error('renderer failed'));
  });
  assert.equal((await list.execute('notify')).value, 7);
  fails = true;
  await assert.rejects(list.execute('notify'), (error) => error.cause === original);
  await new Promise((resolve) => setTimeout(resolve));
  assert.deepEqual(received, [
    ['success', 'saved:7'],
    ['failure', 'Try again'],
  ]);
  remove();
  await assert.rejects(list.execute('notify'));
  assert.equal(received.length, 2);
  cleanup();
  const again = runtime.mount();
  runtime.setNotifier((message, kind) => received.push([kind, message]));
  await assert.rejects(list.execute('notify'));
  assert.equal(received.length, 3, 'remount installs exactly one failure observer');
  again();
});
