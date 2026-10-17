import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  defineService,
  defineAction,
  defineSlot,
  scopeModules,
} from '../dist/core.js';
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 0));
function counter(id, log, requires = []) {
  return definePlugin({
    id,
    services: {
      value: defineService(
        ({ store, onStart, onStop }) => {
          onStart(() => {
            log.push(`start:${id}`);
          });
          onStop(() => {
            log.push(`stop:${id}`);
          });
          return { state: store(0) };
        },
        { requires },
      ),
    },
  });
}

test('replaces affected dependency closure, preserves unrelated service identity and native slot ownership', async () => {
  const log = [];
  const source = counter('source', log),
    consumer = counter('consumer', log, ['source.value']),
    untouched = counter('untouched', log);
  const slots = { tools: defineSlot({ accepts: 'actions' }) };
  const command = definePlugin({
    id: 'command',
    dependencies: ['consumer'],
    actions: { run: defineAction({ title: 'Before', slots: ['tools'], execute: () => 'before' }) },
  });
  const runtime = createRuntime({ slots, plugins: [source, consumer, untouched, command] });
  const stop = runtime.mount();
  await runtime.ready;
  const stable = runtime.services.untouched.value;
  stable.state.set(42);
  const oldConsumer = runtime.services.consumer.value;
  const replacement = { ...source, services: counter('source', log).services };
  log.length = 0;
  const result = await runtime.reconcilePlugins([replacement, consumer, untouched, command]);
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.affected, ['source', 'consumer', 'command']);
  assert.equal(runtime.services.untouched.value, stable);
  assert.equal(stable.state.get(), 42);
  assert.notEqual(runtime.services.consumer.value, oldConsumer);
  assert.deepEqual(log, ['stop:consumer', 'stop:source', 'start:source', 'start:consumer']);
  assert.equal(runtime.slots.get('tools').items.length, 1);
  assert.equal((await runtime.actions.execute('command.run')).value, 'before');
  const changedCommand = {
    ...command,
    actions: { run: defineAction({ title: 'After', slots: ['tools'], execute: () => 'after' }) },
  };
  assert.equal(
    (await runtime.reconcilePlugins([replacement, consumer, untouched, changedCommand])).status,
    'applied',
  );
  assert.equal(runtime.actions.resolve('command.run').title, 'After');
  assert.equal(runtime.slots.get('tools').items.length, 1);
  await stop();
});

test('waits for cancelled action work and async teardown; simultaneous updates are blocked', async () => {
  const work = deferred(),
    drain = deferred();
  let signal;
  const log = [];
  const plugin = definePlugin({
    id: 'job',
    services: {
      value: defineService(({ onStop }) => {
        onStop(async () => {
          log.push('stop');
          await drain.promise;
        });
        return {};
      }),
    },
    actions: {
      run: defineAction({
        execute: async (ctx) => {
          signal = ctx.signal;
          await work.promise;
          log.push('done');
        },
      }),
    },
  });
  const runtime = createRuntime({ plugins: [plugin] });
  const stop = runtime.mount();
  await runtime.ready;
  const running = runtime.actions.execute('job.run');
  await tick();
  const updated = { ...plugin };
  const update = runtime.reconcilePlugins([updated]);
  await tick();
  assert.equal(signal.aborted, true);
  assert.deepEqual(log, []);
  assert.equal((await runtime.reconcilePlugins([updated])).status, 'blocked');
  work.resolve();
  await running;
  await tick();
  assert.deepEqual(log, ['done', 'stop']);
  drain.resolve();
  assert.equal((await update).status, 'applied');
  await stop();
});

test('failed startup cleans only affected work; an explicit new attempt can recover', async () => {
  const log = [];
  const healthy = definePlugin({
    id: 'healthy',
    services: { value: counter('healthy', log).services.value },
    actions: { ping: defineAction({ execute: () => 'healthy' }) },
  });
  const initial = definePlugin({
    id: 'target',
    services: {
      value: defineService(({ store }) => ({ state: store(0) }), { exposeAs: 'targetAlias' }),
    },
  });
  const runtime = createRuntime({ plugins: [healthy, initial] });
  const stop = runtime.mount();
  await runtime.ready;
  const stable = runtime.services.healthy.value;
  const entered = deferred();
  const fail = deferred();
  const broken = {
    ...initial,
    services: {
      value: defineService(
        ({ onStop, onStart }) => {
          onStop(() => log.push('partial'));
          onStart(async () => {
            entered.resolve();
            await fail.promise;
            throw new Error('refused');
          });
          return {};
        },
        { exposeAs: 'targetAlias' },
      ),
    },
  };
  const update = runtime.reconcilePlugins([healthy, broken]);
  await entered.promise;
  assert.equal(runtime.isReady(), true, 'targeted updates preserve initial runtime readiness');
  assert.equal(runtime.isReady('healthy'), true);
  assert.equal(runtime.isReady('target'), false);
  assert.equal(runtime.isServiceReady('healthy.value'), true);
  assert.equal(runtime.isServiceReady('target.value'), false);
  assert.equal(runtime.isServiceReady('targetAlias'), false, 'aliases follow their owning service');
  assert.equal(
    runtime.app.has('targetAlias'),
    false,
    'facade availability follows owner readiness',
  );
  assert.equal((await runtime.actions.execute('healthy.ping')).value, 'healthy');
  fail.resolve();
  assert.equal((await update).status, 'failed');
  assert.ok(log.includes('partial'));
  assert.equal(runtime.services.healthy.value, stable);
  assert.equal(runtime.isReady(), true, 'a targeted failure does not undo initial startup');
  assert.equal(runtime.isReady('target'), false);
  assert.equal(runtime.isServiceReady('target.value'), false);
  assert.equal(runtime.isServiceReady('targetAlias'), false);
  assert.equal((await runtime.actions.execute('healthy.ping')).value, 'healthy');
  assert.equal((await runtime.reconcilePlugins([healthy, initial])).status, 'applied');
  assert.equal(runtime.services.healthy.value, stable);
  assert.equal(runtime.isReady(), true);
  assert.equal(runtime.isReady('target'), true);
  assert.equal(runtime.isServiceReady('target.value'), true);
  assert.equal(runtime.isServiceReady('targetAlias'), true);
  assert.equal(runtime.app.has('targetAlias'), true);
  await stop();
});

test('initial startup gates global readiness and full shutdown clears owner and alias readiness', async () => {
  const start = deferred();
  const plugin = definePlugin({
    id: 'boot',
    services: {
      value: defineService(
        ({ store, onStart }) => {
          onStart(() => start.promise);
          return { state: store(0) };
        },
        { exposeAs: 'bootAlias' },
      ),
    },
  });
  const runtime = createRuntime({ plugins: [plugin] });
  const stop = runtime.mount();
  assert.equal(runtime.isReady(), false);
  assert.equal(runtime.isReady('boot'), false);
  assert.equal(runtime.isServiceReady('boot.value'), false);
  assert.equal(runtime.isServiceReady('bootAlias'), false);
  start.resolve();
  await runtime.ready;
  assert.equal(runtime.isReady(), true);
  assert.equal(runtime.isReady('boot'), true);
  assert.equal(runtime.isServiceReady('boot.value'), true);
  assert.equal(runtime.isServiceReady('bootAlias'), true);
  await stop();
  assert.equal(runtime.isReady(), false);
  assert.equal(runtime.isReady('boot'), false);
  assert.equal(runtime.isServiceReady('boot.value'), false);
  assert.equal(runtime.isServiceReady('bootAlias'), false);
});

test('the first update lifecycle snapshot blocks affected Actions but leaves unrelated Actions live', async () => {
  const target = definePlugin({
    id: 'target',
    services: {
      value: defineService(({ onStop }) => {
        onStop(() => {});
        return {};
      }),
    },
    actions: { run: defineAction({ execute: () => 'target' }) },
  });
  const healthy = definePlugin({
    id: 'healthy',
    actions: { run: defineAction({ execute: () => 'healthy' }) },
  });
  const runtime = createRuntime({ plugins: [target, healthy] });
  const stop = runtime.mount();
  await runtime.ready;
  let attempted;
  const off = runtime.lifecycle.subscribe((snapshot) => {
    if (
      !attempted &&
      snapshot.plugins.find((plugin) => plugin.id === 'target')?.phase === 'stopping'
    )
      attempted = Promise.all([
        runtime.actions.execute('target.run'),
        runtime.actions.execute('healthy.run'),
      ]);
  });
  try {
    assert.equal((await runtime.reconcilePlugins([{ ...target }, healthy])).status, 'applied');
    const [targetAttempt, healthyAttempt] = await attempted;
    assert.equal(targetAttempt.status, 'skipped');
    assert.deepEqual(healthyAttempt, { status: 'completed', value: 'healthy' });
  } finally {
    off();
    await stop();
  }
});

test('affected Actions do not evaluate dynamic presentation before their owner is ready', async () => {
  const startGate = deferred();
  let runtime;
  let presentationReads = 0;
  const target = definePlugin({
    id: 'target',
    services: {
      value: defineService(({ store }) => ({ state: store('ready') })),
    },
    actions: {
      run: defineAction({
        title: () => {
          presentationReads += 1;
          return runtime.services.target.value.state.get();
        },
        execute: () => 'target',
      }),
    },
  });
  const healthy = definePlugin({
    id: 'healthy',
    actions: { run: defineAction({ execute: () => 'healthy' }) },
  });
  runtime = createRuntime({ plugins: [target, healthy] });
  const stop = runtime.mount();
  await runtime.ready;
  const initialPresentationReads = presentationReads;
  const replacement = {
    ...target,
    services: {
      value: defineService(({ store, onStart }) => {
        onStart(() => startGate.promise);
        return { state: store('ready') };
      }),
    },
  };
  const update = runtime.reconcilePlugins([replacement, healthy]);
  await tick();
  try {
    const resolved = runtime.actions.resolve('target.run');
    assert.equal(resolved.enabled, false);
    assert.equal(resolved.visible, false);
    assert.equal(
      presentationReads,
      initialPresentationReads,
      'service-backed presentation stays unevaluated during the update',
    );
    assert.equal((await runtime.actions.execute('target.run')).status, 'skipped');
    assert.equal((await runtime.actions.execute('healthy.run')).value, 'healthy');

    startGate.resolve();
    assert.equal((await update).status, 'applied');
    assert.equal(runtime.actions.resolve('target.run').title, 'ready');
    assert.ok(presentationReads > initialPresentationReads);
    assert.equal((await runtime.actions.execute('target.run')).value, 'target');
  } finally {
    startGate.resolve();
    await stop();
  }
});

test('failed cleanup blocks every further update instead of pretending rollback succeeded', async () => {
  const initial = definePlugin({
    id: 'bad',
    services: {
      value: defineService(({ onStop }) => {
        onStop(() => {
          throw new Error('leak');
        });
        return {};
      }),
    },
  });
  const runtime = createRuntime({ plugins: [initial] });
  const stop = runtime.mount();
  await runtime.ready;
  assert.equal((await runtime.reconcilePlugins([{ ...initial }])).status, 'failed');
  assert.equal((await runtime.reconcilePlugins([{ ...initial }])).status, 'blocked');
  const original = console.error;
  console.error = () => {};
  try {
    await assert.rejects(stop(), /cleanup failed/);
  } finally {
    console.error = original;
  }
  assert.throws(() => runtime.mount(), /failed cleanup/);
});

test('shutdown cancels pending update startup and awaits it before final teardown', async () => {
  const gate = deferred();
  let signal;
  const initial = counter('target', []);
  const runtime = createRuntime({ plugins: [initial] });
  const stop = runtime.mount();
  await runtime.ready;
  const next = {
    ...initial,
    services: {
      value: defineService(({ onStart }) => {
        onStart(async (ctx) => {
          signal = ctx.signal;
          await gate.promise;
        });
        return {};
      }),
    },
  };
  const update = runtime.reconcilePlugins([next]);
  await tick();
  const stopping = stop();
  assert.equal(signal.aborted, true);
  gate.resolve();
  assert.equal((await update).status, 'blocked');
  await stopping;
  assert.equal(runtime.lifecycle.get().phase, 'stopped');
});

test('structural changes are restart-required without side effects; composition readers restart on code changes', async () => {
  const log = [];
  const initial = counter('target', log);
  let reads = 0;
  const projection = definePlugin({
    id: 'projection',
    setup: ({ scope }) => {
      scopeModules(scope);
      reads++;
    },
  });
  const runtime = createRuntime({ plugins: [initial, projection] });
  const stop = runtime.mount();
  await runtime.ready;
  const stable = runtime.services.target.value;
  assert.equal((await runtime.reconcilePlugins([initial])).status, 'restart-required');
  assert.equal(
    (await runtime.reconcilePlugins([{ ...initial, services: {} }, projection])).status,
    'restart-required',
  );
  assert.equal(runtime.services.target.value, stable);
  assert.equal(reads, 1);
  const result = await runtime.reconcilePlugins([{ ...initial }, projection]);
  assert.equal(result.status, 'applied');
  assert.equal(reads, 2);
  await stop();
});

test('stop requested by an update readiness observer cannot publish a stale applied result', async () => {
  const plugin = counter('target', []);
  const runtime = createRuntime({ plugins: [plugin] });
  runtime.mount();
  await runtime.ready;
  let stopping;
  const off = runtime.lifecycle.subscribe((state) => {
    if (runtime.getRevision() && state.phase === 'ready') stopping = runtime.stop();
  });
  const result = await runtime.reconcilePlugins([{ ...plugin }]);
  assert.equal(result.status, 'blocked');
  await stopping;
  off();
  assert.equal(runtime.isReady(), false);
});

test('an unchanged contributor waits through a real slot-owner update and reattaches once', async () => {
  let attachment,
    ownerStop = 0;
  const slots = { panel: defineSlot({ accepts: 'component' }) };
  const owner = definePlugin({
    id: 'owner',
    slots,
    services: {
      value: defineService(({ onStop }) => {
        onStop(() => {
          ownerStop++;
        });
        return {};
      }),
    },
  });
  const widget = () => null;
  let contributorStarts = 0;
  const contributor = definePlugin({
    id: 'contributor',
    setup: ({ scope }) => {
      contributorStarts++;
      attachment = scope.slots.attach(
        { slot: 'owner.panel', id: 'widget', component: widget },
        { availability: 'wait' },
      );
    },
  });
  const runtime = createRuntime({ plugins: [owner, contributor] });
  const stop = runtime.mount();
  await runtime.ready;
  const transitions = [];
  const off = attachment.subscribe((state) => transitions.push(state.phase));
  const result = await runtime.reconcilePlugins([{ ...owner }, contributor]);
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.affected, ['owner']);
  assert.equal(ownerStop, 1);
  assert.equal(contributorStarts, 1);
  assert.equal(runtime.slots.get('owner.panel').items.length, 1);
  assert.equal(attachment.get().phase, 'attached');
  assert.ok(transitions.includes('pending'));
  off();
  await stop();
});
