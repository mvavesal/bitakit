import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import {
  Action,
  ActionGroup,
  createActionList,
  ActionProvider,
  ActionGroupBinding,
  ActionMenuItem,
} from '../dist/actions/index.js';
const dom = new JSDOM('<html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

function View({ groups }) {
  return h(
    'div',
    null,
    groups.map((group) =>
      h(
        'section',
        { key: group.id, 'data-group': group.id },
        group.items.map((item) => h(ActionMenuItem, { key: item.id, binding: item })),
      ),
    ),
  );
}

test('groups react to plugin lifecycle, ordering and state without leaking row context', async () => {
  const group = new ActionGroup('members');
  const alias = new ActionGroup('members'); // Plugins can resolve a published group by its stable ID.
  const list = createActionList();
  const received = [];
  class Promote extends Action {
    isEnabled(context) {
      return context.allowed;
    }
    isVisible(context) {
      return context.role === 'member';
    }
    execute(context) {
      received.push(context.id);
    }
  }
  const action = new Promote({ id: 'promote', title: 'Promote', tooltip: 'Admin rights' });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const allowed = { id: 'alice', role: 'member', allowed: true };
  const denied = { id: 'bob', role: 'member', allowed: false };
  const render = (first = allowed) =>
    h(
      ActionProvider,
      { actions: list },
      h(ActionGroupBinding, { groups: [group], context: first, as: View }),
      h(ActionGroupBinding, { groups: [group], context: denied, as: View }),
    );
  try {
    await act(async () => root.render(render()));
    assert.equal(host.querySelectorAll('section').length, 0);
    let registration;
    await act(async () => {
      registration = list.register(action, { groups: [alias] });
    });
    const buttons = host.querySelectorAll('button');
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].disabled, false);
    assert.equal(buttons[1].disabled, true);
    assert.equal(buttons[0].title, 'Admin rights');
    await act(async () => buttons[0].click());
    assert.deepEqual(received, ['alice']);
    assert.equal((await list.execute('promote', denied)).reason, 'disabled');
    await act(async () => {
      action.title = 'New title';
    });
    assert.equal(host.querySelector('button').textContent, 'New title');
    await act(async () => root.render(render({ ...allowed, role: 'owner' })));
    assert.equal(host.querySelectorAll('button').length, 1);
    assert.equal(list.get('promote').visible, true);
    await act(async () => registration.unregister());
    assert.equal(host.querySelectorAll('section').length, 0);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('interceptors cancel, recheck permissions and cannot execute removed registrations', async () => {
  const list = createActionList();
  const calls = [];
  let enabled = true;
  const old = list.register({
    id: 'run',
    title: 'Run',
    resolve: () => ({ enabled }),
    execute: () => calls.push('old'),
  });
  let gate = deferred();
  const stop = list.use({ before: () => gate.promise });
  const events = [];
  list.subscribeExecution((event) => events.push(event.phase));
  const first = list.execute('run');
  assert.equal(list.get('run').pending, true);
  gate.resolve(false);
  assert.equal((await first).reason, 'intercepted');
  assert.deepEqual(events, ['started', 'skipped']);
  gate = deferred();
  const second = list.execute('run');
  enabled = false;
  gate.resolve(true);
  assert.equal((await second).reason, 'disabled');
  enabled = true;
  gate = deferred();
  const third = list.execute('run');
  old.unregister();
  list.register({ id: 'run', title: 'New', execute: () => calls.push('new') });
  gate.resolve(true);
  assert.equal((await third).reason, 'replaced');
  assert.deepEqual(calls, []);
  stop();
  await list.execute('run');
  assert.deepEqual(calls, ['new']);
});

test('observer failures do not change outcomes; handler failures are observed and pending clears', async () => {
  const list = createActionList([
    {
      id: 'fail',
      title: 'Fail',
      execute: () => {
        throw new Error('expected');
      },
    },
  ]);
  const events = [];
  list.subscribeExecution(() => {
    throw new Error('observer failed');
  });
  list.subscribeExecution((event) => events.push(event.phase));
  await assert.rejects(list.execute('fail'), /expected/);
  assert.deepEqual(events, ['started', 'failed']);
  assert.equal(list.get('fail').pending, false);
});
