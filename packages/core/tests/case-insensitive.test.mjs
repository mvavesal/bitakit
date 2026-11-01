import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  defineService,
  defineContract,
  getService,
  serviceKey,
  defineAction,
  defineEvents,
  event,
  EventService,
  createActionList,
  resolveName,
} from '../dist/core.js';

test('additive name resolution preserves exact case-only IDs and rejects ambiguous references', () => {
  assert.equal(resolveName('Foo', ['Foo', 'foo']), 'Foo');
  assert.equal(resolveName('foo', ['Foo', 'foo']), 'foo');
  assert.throws(() => resolveName('FOO', ['Foo', 'foo']), /Ambiguous/);
  assert.equal(resolveName('FOO', ['Foo', 'Foo']), 'Foo');
});

test('mixed-case services, contracts, requires and plugin dependencies resolve without renaming', async () => {
  const contract = defineContract('MailSender').of();
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'Consumer',
        dependencies: ['pRoViDeR'],
        services: {
          derived: defineService(
            ({ services }) => getService(services, serviceKey('MAILSENDER')) + 1,
            { requires: ['mailsender'] },
          ),
        },
      }),
      definePlugin({
        id: 'Provider',
        services: { mail: defineService(() => 41, { provides: contract }) },
      }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    assert.equal(runtime.services.CONSUMER.DERIVED, 42);
    assert.equal(runtime.services.mailsender, 41);
    assert.equal(runtime.isReady('PROVIDER'), true);
    assert.equal(runtime.app.has('MAILSENDER'), true);
    assert.deepEqual(Object.keys(runtime.services), ['Consumer', 'Provider', 'MailSender']);
  } finally {
    await stop();
  }
});

test('case-only service and plugin registrations keep independent exact identities', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({ id: 'Feature', services: { value: defineService(() => 1) } }),
      definePlugin({ id: 'feature', services: { value: defineService(() => 2) } }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    assert.equal(runtime.services.Feature.value, 1);
    assert.equal(runtime.services.feature.value, 2);
    assert.throws(() => runtime.services.FEATURE.value, /Ambiguous/);
  } finally {
    await stop();
  }
});

test('Action lookup, execution, mutations and concurrency use the registered identity', async () => {
  let calls = 0;
  const actions = createActionList([{ id: 'Reports.send', title: 'send', execute: () => ++calls }]);
  assert.equal(actions.get('reports.SEND').id, 'Reports.send');
  assert.equal((await actions.execute('REPORTS.SEND')).value, 1);
  actions.update('reports.send', { title: 'updated' });
  assert.deepEqual(Object.keys(actions.getState().actions), ['Reports.send']);
  actions.register({ id: 'reports.send', title: 'second', execute: () => 99 });
  assert.equal((await actions.execute('reports.send')).value, 99);
  await assert.rejects(actions.execute('REPORTS.SEND'), /Ambiguous/);
  actions.dispose();
});

test('event payloads retain canonical names, wildcard listeners resolve and ownership holds', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'Reports',
        events: defineEvents({ Finished: event() }),
        actions: {
          send: defineAction({ execute: ({ events }) => events.emit('REPORTS.FINISHED') }),
        },
      }),
      definePlugin({
        id: 'other',
        actions: {
          spoof: defineAction({ execute: ({ events }) => events.emit('reports.finished') }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    const seen = [];
    runtime.events.on('rEpOrTs.*', (e) => seen.push(e.type));
    await runtime.actions.execute('reports.SEND');
    assert.deepEqual(seen, ['Reports.Finished']);
    await assert.rejects(runtime.actions.execute('other.spoof'), /cannot emit/);
  } finally {
    await stop();
  }
});

test('case-only declared events keep exact subscriptions separate', () => {
  const events = new EventService();
  events.declare('p', defineEvents({ Done: event(), done: event() }));
  const seen = [];
  events.on('p.Done', () => seen.push('upper'));
  events.on('p.done', () => seen.push('lower'));
  events.emit('p.Done');
  events.emit('p.done');
  assert.deepEqual(seen, ['upper', 'lower']);
  assert.throws(() => events.emit('P.DONE'), /Ambiguous/);
});

test('mixed-case action overrides are applied at initial registration', async () => {
  const runtime = createRuntime({
    actionOverrides: { 'FEATURE.RUN': { enabled: false } },
    plugins: [
      definePlugin({ id: 'Feature', actions: { run: defineAction({ execute: () => 1 }) } }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    assert.equal(runtime.actions.get('feature.run').enabled, false);
  } finally {
    await stop();
  }
});

test('wildcard references resolve nested namespaces without merging case-only owners', async () => {
  const { matchesTarget } = await import('../dist/core.js');
  assert.equal(matchesTarget('FEATURE.*', 'Feature.nested.run', ['Feature.nested.run']), true);
  assert.equal(
    matchesTarget('Feature.*', 'Feature.nested.run', ['Feature.nested.run', 'feature.nested.run']),
    true,
  );
  assert.equal(
    matchesTarget('feature.*', 'Feature.nested.run', ['Feature.nested.run', 'feature.nested.run']),
    false,
  );
  assert.throws(
    () =>
      matchesTarget('FEATURE.*', 'Feature.nested.run', [
        'Feature.nested.run',
        'feature.nested.run',
      ]),
    /Ambiguous/,
  );
});

test('reserved runtime events resolve mixed-case listeners without weakening ownership', () => {
  const errors = [];
  const events = new EventService((error) => errors.push(error));
  const publish = events.reserve('runtime');
  const seen = [];
  events.on('RUNTIME.LIFECYCLE', (event) => seen.push(event.type));
  publish('runtime.lifecycle', { phase: 'ready' });
  assert.deepEqual(seen, ['runtime.lifecycle']);
  assert.throws(() => events.emit('RUNTIME.LIFECYCLE'), /only by the runtime/);
  events.declare('Runtime', defineEvents({ lifecycle: event() }));
  const exact = [];
  events.on('Runtime.lifecycle', (event) => exact.push(event.type));
  events.emit('Runtime.lifecycle');
  assert.deepEqual(exact, ['Runtime.lifecycle']);
  assert.equal(errors.length, 1);
  assert.throws(() => events.emit('RUNTIME.LIFECYCLE'), /Ambiguous/);
});
