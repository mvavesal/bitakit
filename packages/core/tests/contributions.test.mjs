import test from 'node:test';
import assert from 'node:assert/strict';
import { Action, createActionList } from '@bitakit/core/actions';
import { FoundationRuntime, defineAction, defineFormAction, ActionFailure } from '../dist/core.js';

function mountWith(actions, messages = {}) {
  const list = createActionList();
  const notifications = [];
  const runtime = new FoundationRuntime(list, { plugins: [{ id: 'demo', actions }] });
  runtime.setTranslations(
    Object.assign((key) => messages[key] ?? key, { has: (key) => Object.hasOwn(messages, key) }),
  );
  runtime.setNotifier((message) => notifications.push(message));
  const cleanup = runtime.mount();
  return { list, runtime, notifications, cleanup };
}

test('completed executions return the handler value for commands, class actions and form submissions', async () => {
  class Create extends Action {
    async execute(input) {
      return { id: `created:${input}` };
    }
  }
  const { list, cleanup } = mountWith([
    defineAction({ id: 'demo.count', execute: () => 42, success: false }),
    () => new Create({ id: 'demo.create', title: 'Create' }),
    defineFormAction({
      id: 'demo.invite',
      fields: { email: { type: 'email' } },
      submit: ({ email }) => ({ email }),
    }),
  ]);
  assert.deepEqual(await list.execute('demo.count'), { status: 'completed', value: 42 });
  assert.deepEqual(await list.execute('demo.create', 'a'), {
    status: 'completed',
    value: { id: 'created:a' },
  });
  await list.execute('demo.invite');
  assert.deepEqual(await list.execute('demo.invite.submit', { email: 'a@example.com' }), {
    status: 'completed',
    value: { email: 'a@example.com' },
  });
  cleanup();
});

test('class actions receive the invocation context and may update only their own registration', async () => {
  class Toggle extends Action {
    execute(value, context) {
      context.update({ checked: value });
      return context.id;
    }
  }
  const { list, cleanup } = mountWith([
    () => new Toggle({ id: 'demo.toggle', title: 'Toggle', checked: false }),
  ]);
  assert.equal((await list.execute('demo.toggle', true)).value, 'demo.toggle');
  assert.equal(list.get('demo.toggle').checked, true);
  cleanup();
});

test('class feedback is opt-in: declared messages use the shared pipeline, undeclared errors stay raw', async () => {
  const boom = new Error('Secret');
  class Silent extends Action {
    execute() {
      throw boom;
    }
  }
  class Loud extends Action {
    success = ({ result, input }) => `${result}:${input}`;
    failure = ({ error }) => (error === boom ? { messageKey: 'demo.failed' } : undefined);
    execute(input) {
      if (input === 'fail') throw boom;
      return 'ok';
    }
  }
  const { list, notifications, cleanup } = mountWith(
    [
      () => new Silent({ id: 'demo.silent', title: 'Silent' }),
      () => new Loud({ id: 'demo.loud', title: 'Loud' }),
    ],
    { 'demo.failed': 'Fehlgeschlagen' },
  );
  await assert.rejects(list.execute('demo.silent'), (error) => error === boom);
  assert.deepEqual(notifications, []);
  await list.execute('demo.loud', 'a');
  assert.deepEqual(notifications, ['ok:a']);
  await assert.rejects(list.execute('demo.loud', 'fail'), (error) => {
    assert.ok(error instanceof ActionFailure);
    assert.equal(error.feedback, 'Fehlgeschlagen');
    assert.equal(error.cause, boom);
    return true;
  });
  assert.equal(list.get('demo.loud').pending, false);
  cleanup();
});

test('form submission registrations are internal: executable, translated, but hidden from enumeration', () => {
  const { list, runtime, cleanup } = mountWith(
    [defineFormAction({ id: 'demo.invite', title: 'invite.title', fields: {}, submit() {} })],
    { 'invite.title': 'Einladen' },
  );
  assert.equal(list.get('demo.invite').internal, undefined);
  assert.equal(list.get('demo.invite.submit').internal, true);
  assert.equal(list.get('demo.invite.submit').title, 'Einladen');
  runtime.setTranslations((key) => (key === 'invite.title' ? 'Invite' : key));
  assert.equal(list.get('demo.invite.submit').title, 'Invite');
  cleanup();
});
