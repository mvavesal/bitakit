import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Action,
  ActionGroup,
  createActionList,
  NavigationHost,
} from '@bitakit/core/actions';
import {
  FoundationRuntime,
  defineAction,
  defineURLAction,
  resolveContribution,
} from '../dist/core.js';

test('groups are inferred, shared across plugins, and dynamic API placements clean up', () => {
  const list = createActionList();
  const typed = new ActionGroup('members.menu');
  let dynamic;
  const runtime = new FoundationRuntime(list, {
    plugins: [
      {
        id: 'one',
        actions: [defineAction({ id: 'one.run', groups: ['menu', typed] })],
        setup({ app }) {
          dynamic = app.actions.getGroup('extra').attach('one.run');
        },
      },
      { id: 'two', actions: [defineAction({ id: 'two.run', groups: ['menu'] })] },
    ],
  });
  const empty = runtime.getGroup('menu');
  const dispose = runtime.mount();
  assert.equal(runtime.getGroup('menu'), empty);
  assert.equal(runtime.getGroup('members.menu'), typed);
  assert.deepEqual(
    list.get('one.run').groups.map((g) => g.id),
    ['menu', 'members.menu', 'extra'],
  );
  assert.equal(list.get('one.run').groups[0], list.get('two.run').groups[0]);
  dynamic.dispose();
  assert.deepEqual(
    list.get('one.run').groups.map((g) => g.id),
    ['menu', 'members.menu'],
  );
  dispose();
  assert.deepEqual(Object.keys(list.getState().actions), []);
  assert.throws(() => runtime.getGroup('invalid group'), /Invalid action group/);
});

test('direct Action exports use host services, preserve connections on locale updates and own cleanup', async () => {
  let connects = 0,
    disconnects = 0,
    calls = 0,
    seen;
  class Existing extends Action {
    connect() {
      connects++;
      return () => disconnects++;
    }
    execute() {
      calls++;
    }
  }
  const service = {};
  const definition = ({ services, translate }) => {
    assert.equal(services.settings, service);
    seen = translate;
    return new Existing({ title: 'title' });
  };
  const list = createActionList();
  const runtime = new FoundationRuntime(
    list,
    { plugins: [{ id: 'app', actions: [resolveContribution(definition, 'account.run')] }] },
    { settings: service },
  );
  runtime.setTranslations((key) => `en:${key}`);
  const unmount = list.mount();
  const dispose = runtime.mount();
  assert.equal(connects, 1);
  await list.execute('account.run');
  assert.equal(calls, 1);
  runtime.setTranslations((key) => `de:${key}`);
  assert.equal(list.get('account.run').title, 'de:title');
  assert.equal(seen('confirm'), 'de:confirm');
  assert.equal(connects, 1);
  dispose();
  assert.equal(disconnects, 1);
  unmount();
  assert.equal(disconnects, 1);
});

test('discovered navigation retains the latest href and never executes a stale destination', async () => {
  const host = new NavigationHost();
  const urls = [];
  const release = host.bind((url) => urls.push(url));
  const list = createActionList([], { environment: host });
  const runtime = new FoundationRuntime(list, {
    plugins: [
      {
        id: 'app',
        actions: [
          resolveContribution(
            defineURLAction({ href: '/first', groups: ['navigation'] }),
            'navigation.home',
          ),
        ],
      },
    ],
  });
  const dispose = runtime.mount();
  list.update('navigation.home', { href: '/second' });
  await list.execute('navigation.home');
  assert.deepEqual(urls, ['/second']);
  dispose();
  release();
  assert.throws(() => resolveContribution({}, 'invalid'), /Invalid action export/);
});

test('configured interceptors run in order, cancel safely, and clean up without touching host hooks', async () => {
  const { defineInterceptor } = await import('../dist/core.js');
  const log = [];
  const list = createActionList();
  list.use({
    before() {
      log.push('host');
    },
  });
  const runtime = new FoundationRuntime(
    list,
    {
      interceptors: [
        defineInterceptor({
          requires: ['confirm'],
          create: ({ services }) => ({
            before: () => {
              log.push('first');
              return services.confirm();
            },
          }),
        }),
        defineInterceptor({
          create: () => ({
            before: () => {
              log.push('second');
              return false;
            },
          }),
        }),
      ],
      plugins: [
        {
          id: 'app',
          actions: [
            defineAction({
              id: 'run',
              execute() {
                log.push('execute');
              },
            }),
          ],
        },
      ],
    },
    { confirm: () => true },
  );
  const dispose = runtime.mount();
  assert.equal((await list.execute('run')).reason, 'intercepted');
  assert.deepEqual(log, ['host', 'first', 'second']);
  dispose();
  log.length = 0;
  list.register({
    id: 'later',
    title: 'Later',
    execute() {
      log.push('execute');
    },
  });
  await list.execute('later');
  assert.deepEqual(log, ['host', 'execute']);
});

test('config disabling remains effective across native subscriptions and never bypasses native guards', async () => {
  let instance;
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    actionOverrides: {
      plain: { enabled: false },
      native: { enabled: false },
      form: { visible: false },
    },
    plugins: [
      {
        id: 'app',
        actions: [
          defineAction({
            id: 'plain',
            execute() {
              assert.fail('Disabled action executed');
            },
          }),
          () => {
            instance = new Action({ id: 'native', title: 'Native' });
            return instance;
          },
          (await import('../dist/core.js')).defineFormAction({
            id: 'form',
            fields: {},
            submit() {},
          }),
        ],
      },
    ],
  });
  const dispose = runtime.mount();
  instance.enabled = true;
  assert.equal(list.resolve('native').enabled, false);
  assert.equal((await list.execute('native')).reason, 'disabled');
  assert.equal((await list.execute('plain')).reason, 'disabled');
  list.update('form', { visible: true });
  assert.equal(list.resolve('form').visible, false);
  assert.equal((await list.execute('form')).reason, 'hidden');
  dispose();
});

test('default Action classes are discovered directly, metadata stays on the class and instances belong to a runtime', () => {
  let constructed = 0;
  class Logout extends Action {
    constructor() {
      super({
        id: 'account.signOut',
        title: 'Sign out',
        groups: [new ActionGroup('account.menu')],
      });
      constructed++;
    }
  }
  const entry = resolveContribution(Logout, 'account.logout');
  assert.equal(constructed, 0, 'discovery must not instantiate classes');
  const first = createActionList();
  const second = createActionList();
  const releaseFirst = new FoundationRuntime(first, { actions: [entry] }).mount();
  const releaseSecond = new FoundationRuntime(second, { actions: [entry] }).mount();
  assert.equal(constructed, 2);
  assert.equal(first.get('account.logout'), undefined);
  assert.equal(first.get('account.signOut').title, 'Sign out');
  assert.equal(first.get('account.signOut').groups[0].id, 'account.menu');
  first.update('account.signOut', { title: 'Changed' });
  assert.equal(second.get('account.signOut').title, 'Sign out');
  releaseFirst();
  releaseSecond();
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        actions: [resolveContribution(() => ({}), 'invalid')],
      }).mount(),
    /must return an Action instance/,
  );
});
