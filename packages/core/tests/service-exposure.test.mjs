import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationRuntime,
  createActionList,
  definePlugin,
  defineService,
  provideService,
  serviceKey,
  getService,
  defineServiceInterceptor,
  discoverServices,
  discoverPublicServices,
  discoveredFile,
} from '../dist/core.js';

test('inline names share the container instance, lifecycle and interceptor pipeline', () => {
  const key = serviceKey('internal.clock');
  let created = 0;
  const disposed = [];
  const observed = [];
  class Clock {
    #count = ++created;
    now() {
      return this.#count;
    }
  }
  const plugin = definePlugin({
    id: 'clock',
    services: [
      provideService(key, {
        exposeAs: 'tools.clock',
        create: () => new Clock(),
        dispose: (instance) => disposed.push(instance.now()),
      }),
    ],
    interceptors: [
      defineServiceInterceptor({
        service: 'tools.clock',
        method: 'now',
        after: ({ result }) => observed.push(result),
      }),
    ],
  });
  const runtime = new FoundationRuntime(createActionList(), { plugins: [plugin] });
  assert.equal(created, 0);
  assert.equal(runtime.app.optional.services.tools.clock, undefined);
  assert.throws(() => runtime.app.services.tools.clock, /unavailable/);
  const stop = runtime.mount();
  const first = runtime.app.services.tools.clock;
  assert.equal(first, getService(runtime.services, key));
  assert.equal(first.now(), 1);
  assert.deepEqual(observed, [1]);
  stop();
  assert.deepEqual(disposed, [1]);
  assert.equal(runtime.app.optional.services.tools.clock, undefined);
  first.now();
  assert.deepEqual(observed, [1]);
  const stopAgain = runtime.mount();
  assert.notEqual(runtime.app.services.tools.clock, first);
  assert.equal(runtime.app.services.tools.clock.now(), 2);
  stopAgain();
  assert.deepEqual(disposed, [1, 2]);
});

test('direct definitions and legacy aliases resolve without mutating plugin definitions', () => {
  const key = serviceKey('clock.source');
  const clock = { now: () => 42 };
  const definition = defineService({ id: key, exposeAs: 'clock', create: () => clock });
  const runtime = new FoundationRuntime(createActionList(), {
    services: [definition],
    publicServices: { clock: key, oldClock: key },
  });
  const stop = runtime.mount();
  assert.equal(runtime.app.services.clock, clock);
  assert.equal(runtime.app.services.oldClock, clock);
  assert.equal(definition.exposeAs, 'clock');
  stop();
});

test('inline names preserve existing collision and reserved-path checks before construction', () => {
  let created = 0;
  const service = (id, exposeAs) => defineService({ id, exposeAs, create: () => ++created });
  for (const name of ['', 'then', 'tools.__proto__', 'tools.toJSON']) {
    assert.throws(
      () =>
        new FoundationRuntime(createActionList(), {
          services: [service('one', name)],
        }),
      /reserved segment/,
    );
  }
  for (const services of [
    [service('one', 'clock'), service('two', 'clock')],
    [service('one', 'clock'), service('two', 'clock.child')],
    [service('one', 'clock.child'), service('two', 'clock')],
  ]) {
    assert.throws(
      () => new FoundationRuntime(createActionList(), { services }),
      /exposes two services named "clock"|is nested under "clock"|already used as a service namespace/,
    );
  }
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        plugins: [
          { id: 'one', services: [service('one', 'clock')] },
          { id: 'two', services: [service('two', 'clock')] },
        ],
      }),
    /Plugins "one" and "two" both expose a service named "clock"/,
  );
  assert.throws(
    () =>
      new FoundationRuntime(createActionList(), {
        publicServices: { clock: serviceKey('different') },
        services: [service('one', 'clock')],
      }),
    /exposes two services named "clock"/,
  );
  assert.equal(created, 0);
});

test('discovery carries default and overridden names without a second alias list', () => {
  const files = [
    discoveredFile(defineService({ create: () => ({ value: 1 }) }), 'clock', 'services/clock.ts'),
    discoveredFile(
      {
        helper: defineService({ exposeAs: 'tools.helper', create: () => ({ value: 2 }) }),
        shared: provideService(serviceKey('shared.key'), { exposeAs: 'shared', create: () => 3 }),
      },
      '',
      'services.ts',
    ),
  ];
  const services = discoverServices(files, 'feature');
  assert.deepEqual(
    services.map(({ id, exposeAs }) => [id, exposeAs]),
    [
      ['feature.clock', 'clock'],
      ['feature.helper', 'tools.helper'],
      ['shared.key', 'shared'],
    ],
  );
  const runtime = new FoundationRuntime(createActionList(), { services });
  const stop = runtime.mount();
  assert.equal(runtime.app.services.clock, runtime.services['feature.clock']);
  assert.equal(runtime.app.services.tools.helper.value, 2);
  assert.equal(runtime.app.services.shared, 3);
  stop();
  // Previously generated hosts may still supply both forms; the same mapping is idempotent.
  const compatible = new FoundationRuntime(createActionList(), {
    services,
    publicServices: discoverPublicServices(files, 'feature'),
  });
  const cleanup = compatible.mount();
  assert.equal(compatible.app.services.tools.helper.value, 2);
  cleanup();
});
