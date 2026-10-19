import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  defineContract,
  definePlugin,
  defineService,
  getService,
  serviceKey,
} from '../dist/core.js';

test('typed keys use the shared plugin container with dependency order and reverse cleanup', async () => {
  const base = serviceKey('base');
  const derived = defineContract('derived').of();
  const stopped = [];
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'services',
        services: {
          derived: defineService(
            ({ services, onStop }) => {
              onStop(() => stopped.push('derived'));
              return getService(services, base) + 1;
            },
            { requires: [base], provides: derived },
          ),
          base: defineService(
            ({ onStop }) => {
              onStop(() => stopped.push('base'));
              return 4;
            },
            { provides: base },
          ),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  assert.equal(getService(runtime.services, derived), 5);
  assert.equal(runtime.services.derived, 5);
  assert.equal(runtime.services.services.derived, 5);
  assert.throws(
    () => getService(runtime.services, serviceKey('missing')),
    /Missing service "missing"/,
  );
  assert.throws(
    () => getService({ nested: {} }, serviceKey('nested.deep')),
    /Missing service "nested\.deep"/,
  );
  await stop();
  assert.deepEqual(stopped, ['derived', 'base']);
});

test('empty keys and two providers of one contract fail before execution', async () => {
  assert.throws(() => serviceKey('  '), /must not be empty/);
  const key = serviceKey('same');
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          definePlugin({
            id: 'duplicate',
            services: {
              one: defineService(() => 1, { provides: key }),
              two: defineService(() => 2, { provides: key }),
            },
          }),
        ],
      }),
    /Two services are named "same" \(duplicate\.one and duplicate\.two\)/,
  );
});

test('defineContract writes the name once and returns the same key from of()', () => {
  const contract = defineContract('notes');
  assert.equal(typeof contract.of, 'function');
  assert.equal(contract.of(), 'notes');
  assert.equal(contract.of(), serviceKey('notes'));
  assert.throws(() => defineContract('  '), /must not be empty/);
});
