import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';

const {
  EventService,
  createRuntime,
  defineAction,
  defineDialogAction,
  definePage,
  definePlugin,
  defineService,
  defineServiceInterceptor,
  defineSetup,
  defineURLAction,
  defineView,
  findPluginPage,
  provideService,
  serviceKey,
} = core;

async function capture(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    return [await run(), warnings];
  } finally {
    console.warn = original;
  }
}

test('removed helpers are gone from the public surface', () => {
  for (const name of [
    'defineFormAction',
    'defineActionInterceptor',
    'discoverPublicServices',
    'defineProvider',
    'validateFields',
  ])
    assert.equal(core[name], undefined, name);
  assert.throws(
    () => core.defineConfig({ maxItems: 1 }),
    /expects \{ defaults \} and\/or \{ schema \}/,
  );
  assert.equal(
    typeof core.defineAction({ execute() {} }),
    'object',
    'the curried builder is gone: defineAction returns a spec',
  );
});

test('deprecated shims map onto the current API and warn once per helper', async () => {
  const key = serviceKey('time.source');
  const clock = { now: () => 42 };
  const Dialog = () => null;
  const Page = () => null;
  const observed = [];
  const compose = () =>
    createRuntime({
      services: [defineService({ id: key, exposeAs: 'clock', create: () => clock })],
      publicServices: { oldClock: key },
      plugins: [
        definePlugin({
          id: 'legacy',
          services: {
            mail: provideService(serviceKey('mailer'), { create: () => ({ send: () => 'sent' }) }),
          },
          interceptors: [
            defineServiceInterceptor({
              service: 'mailer',
              method: 'send',
              after: ({ result }) => observed.push(result),
            }),
          ],
          actions: {
            home: defineURLAction({ title: 'Home', href: '/' }),
            rename: defineDialogAction({ title: 'Rename', render: Dialog, size: 'wide' }),
            resolved: defineAction({
              resolve: (input) => ({ enabled: input === 'ok' }),
              watch: ['clock'],
              execute: () => 'ran',
            }),
          },
          pages: [definePage({ path: '/legacy', component: Page })],
          views: [defineView({ slot: 'app-bar.end', component: Page })],
          setup: defineSetup(() => {}),
        }),
      ],
    });
  const [{ runtime, stop }, warnings] = await capture(() => {
    const runtime = compose();
    return { runtime, stop: runtime.mount() };
  });
  try {
    assert.equal(runtime.services.clock, clock);
    assert.equal(runtime.services.oldClock, clock);
    assert.equal(runtime.services.time.source, clock);
    assert.equal(runtime.services.mailer, runtime.services.legacy.mail);
    assert.equal(runtime.services.mailer.send(), 'sent');
    assert.deepEqual(observed, ['sent']);
    assert.equal(runtime.actions.get('legacy.home').href, '/');
    await runtime.actions.execute('legacy.rename', 1);
    assert.equal(runtime.getSnapshot().definition.dialog, Dialog);
    assert.equal(runtime.getSnapshot().definition.dialogSize, 'wide');
    assert.equal(runtime.actions.resolve('legacy.resolved', 'ok').enabled, true);
    assert.equal(runtime.actions.resolve('legacy.resolved', 'no').enabled, false);
    assert.equal((await runtime.actions.execute('legacy.resolved', 'ok')).value, 'ran');
    assert.equal(findPluginPage(runtime.modules, '/legacy').component, Page);
    assert.equal(
      runtime.modules.find((module) => module.id === 'legacy').views[0].slot,
      'app-bar.end',
    );
  } finally {
    stop();
  }
  for (const helper of [
    'provideService',
    'defineURLAction',
    'defineDialogAction',
    'definePage',
    'defineView',
    'defineServiceInterceptor',
    'publicServices',
    'resolve',
    'watch',
  ])
    assert.equal(
      warnings.filter((warning) => warning.startsWith(`[bitakit] ${helper} is deprecated.`)).length,
      1,
      `${helper} warns exactly once: ${warnings.join(' | ')}`,
    );
  assert.equal(warnings.length, 9, warnings.join(' | '));
  const [, again] = await capture(() => {
    const runtime = compose();
    runtime.mount()();
  });
  assert.deepEqual(again, [], 'each deprecation is reported once per process');
});

test('events.watch remains an alias of events.on on the bus and in scoped contexts', () => {
  const bus = new EventService();
  assert.equal(bus.watch, bus.on);
  let seen = 0;
  const runtime = createRuntime({
    services: {
      listener: defineService(({ events }) => {
        events.watch('ping', () => seen++);
        return {};
      }),
    },
  });
  const stop = runtime.mount();
  try {
    runtime.events.emit('ping');
    assert.equal(seen, 1);
  } finally {
    stop();
  }
  runtime.events.emit('ping');
  assert.equal(seen, 1, 'scoped listeners are released on stop');
});
