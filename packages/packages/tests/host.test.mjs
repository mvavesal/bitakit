import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, definePlugin, defineService, defineAction } from '@bitakit/core';
import { createPackageHost } from '../dist/index.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const plugin = (id, options = {}) =>
  definePlugin({
    id,
    services: {
      value: defineService(
        ({ store, onStart, onStop }) => {
          if (options.start) onStart(options.start);
          if (options.stop) onStop(options.stop);
          return store(1);
        },
        { requires: options.requires },
      ),
    },
    actions: { run: defineAction({ title: id, execute: () => id }) },
  });
const request = (scope, ...names) => ({
  scope,
  packages: names.map((name) => ({ name, version: '1.0.0' })),
});
async function host(t, catalog, plugins = []) {
  const runtime = createRuntime({ plugins });
  const stop = runtime.mount();
  await runtime.ready;
  t.after(() => stop().catch(() => {}));
  return { runtime, packages: createPackageHost({ runtime, catalog }) };
}

test('a trusted selection loads multiple plugins together and preserves an unrelated store', async (t) => {
  let loads = 0;
  const { runtime, packages } = await host(
    t,
    {
      notes: {
        version: '1.0.0',
        load: async () => {
          loads++;
          return [plugin('consumer', { requires: ['provider.value'] }), plugin('provider')];
        },
      },
    },
    [plugin('keeper')],
  );
  const keeper = runtime.services.keeper.value;
  keeper.set(77);
  assert.equal((await packages.reconcile(request('A', 'notes'))).status, 'applied');
  assert.equal(
    packages.get().packages[0].plugins.every((entry) => entry.ready),
    true,
  );
  assert.equal((await packages.reconcile(request('A', 'notes'))).status, 'applied');
  assert.equal(loads, 1);
  assert.equal((await packages.reconcile(request('A'))).status, 'applied');
  assert.equal(runtime.actions.get('provider.run'), undefined);
  assert.equal(packages.get().packages.length, 0);
  assert.equal(runtime.services.keeper.value, keeper);
  assert.equal(keeper.get(), 77);
});

test('unknown sources and versions never load or remove the active package', async (t) => {
  const { runtime, packages } = await host(t, {
    notes: { version: '1.0.0', load: async () => [plugin('notes')] },
  });
  await packages.reconcile(request('A', 'notes'));
  const notes = runtime.services.notes.value;
  assert.equal(
    (await packages.reconcile(request('B', 'https://untrusted.test/plugin.js'))).status,
    'blocked',
  );
  assert.equal(
    (await packages.reconcile({ scope: 'B', packages: [{ name: 'notes', version: '2.0.0' }] }))
      .status,
    'blocked',
  );
  assert.equal(packages.get().scope, 'A');
  assert.equal(runtime.services.notes.value, notes);
});

test('a late import cannot activate in a newer scope or block its loading', async (t) => {
  const old = deferred();
  const { runtime, packages } = await host(t, {
    slow: { version: '1.0.0', load: () => old.promise },
    fast: { version: '1.0.0', load: async () => [plugin('fast')] },
  });
  const first = packages.reconcile(request('A', 'slow'));
  await tick();
  const second = packages.reconcile(request('B', 'fast'));
  assert.equal((await first).status, 'superseded');
  assert.equal((await second).status, 'applied');
  old.resolve([plugin('slow')]);
  await tick();
  assert.equal(runtime.isReady('slow'), false);
  assert.equal(runtime.isReady('fast'), true);
  assert.equal(packages.get().scope, 'B');
});

test('switching scope reloads even the same package after cleanup and preserves host services', async (t) => {
  let stopped = 0;
  const { runtime, packages } = await host(
    t,
    { notes: { version: '1.0.0', load: async () => [plugin('notes', { stop: () => stopped++ })] } },
    [plugin('keeper')],
  );
  await packages.reconcile(request('A', 'notes'));
  const old = runtime.services.notes.value;
  old.set(41);
  const stable = runtime.services.keeper.value;
  assert.equal((await packages.reconcile(request('B', 'notes'))).status, 'applied');
  assert.equal(stopped, 1);
  assert.notEqual(runtime.services.notes.value, old);
  assert.equal(runtime.services.notes.value.get(), 1);
  assert.equal(runtime.services.keeper.value, stable);
});

test('nested lifecycle requests return blocked rather than waiting on themselves', async (t) => {
  let packages, nested;
  const hostResult = await host(t, {
    notes: {
      version: '1.0.0',
      load: async () => [
        plugin('notes', {
          start: async () => {
            nested = await packages.reconcile(request('nested'));
          },
        }),
      ],
    },
  });
  packages = hostResult.packages;
  assert.equal((await packages.reconcile(request('A', 'notes'))).status, 'applied');
  assert.equal(nested.status, 'blocked');
  assert.equal(packages.get().scope, 'A');
});

test('failed startup retains truthful ownership and allows explicit clean retry', async (t) => {
  let fail = true;
  const { runtime, packages } = await host(t, {
    notes: {
      version: '1.0.0',
      load: async () => [
        plugin('notes', {
          start: () => {
            if (fail) throw new Error('not ready');
          },
        }),
      ],
    },
  });
  assert.equal((await packages.reconcile(request('A', 'notes'))).status, 'failed');
  assert.equal(packages.get().packages[0].plugins[0].ready, false);
  fail = false;
  assert.equal((await packages.reconcile(request('A', 'notes'))).status, 'applied');
  assert.equal(runtime.isReady('notes'), true);
});

test('failed cleanup retains the old scope and prevents replacement', async (t) => {
  const { packages } = await host(t, {
    notes: {
      version: '1.0.0',
      load: async () => [
        plugin('notes', {
          stop: () => {
            throw new Error('cleanup');
          },
        }),
      ],
    },
  });
  await packages.reconcile(request('A', 'notes'));
  assert.equal((await packages.reconcile(request('B', 'notes'))).status, 'failed');
  assert.equal(packages.get().scope, 'A');
  assert.equal((await packages.reconcile(request('B', 'notes'))).status, 'blocked');
});

test('overlapping package IDs fail before either package activates', async (t) => {
  const { runtime, packages } = await host(t, {
    one: { version: '1.0.0', load: async () => [plugin('same')] },
    two: { version: '1.0.0', load: async () => [plugin('same')] },
  });
  assert.equal((await packages.reconcile(request('A', 'one', 'two'))).status, 'blocked');
  assert.equal(runtime.config.plugins.length, 0);
});

test('a failed loader is retryable and shutdown during loading prevents activation', async (t) => {
  let fail = true;
  const gate = deferred();
  const { runtime, packages } = await host(t, {
    notes: {
      version: '1.0.0',
      load: async () => {
        if (fail) throw new Error('fetch failed');
        await gate.promise;
        return [plugin('notes')];
      },
    },
  });
  assert.equal((await packages.reconcile(request('A', 'notes'))).status, 'failed');
  fail = false;
  const addition = packages.reconcile(request('A', 'notes'));
  await tick();
  await runtime.stop();
  gate.resolve();
  assert.equal((await addition).status, 'blocked');
  assert.equal(runtime.config.plugins.length, 0);
});

test('canonical package selection checks all known IDs before importing and binds multi-plugin loaders individually', async (t) => {
  let imports = 0;
  const { runtime, packages } = await host(t, {
    '@ACME/One': {
      version: '1.0.0',
      pluginIds: ['collision'],
      load: async () => {
        imports++;
        return [plugin('collision')];
      },
    },
    '@other/two': {
      version: '1.0.0',
      pluginIds: ['collision'],
      load: async () => {
        imports++;
        return [plugin('collision')];
      },
    },
    legacy: { version: '1.0.0', load: async () => [plugin('first'), plugin('second')] },
  });
  assert.equal(
    (await packages.reconcile(request('A', '@acme/ONE', '@OTHER/two'))).status,
    'blocked',
  );
  assert.equal(imports, 0);
  assert.equal((await packages.reconcile(request('A', '@acme/one'))).status, 'applied');
  assert.equal(imports, 1);
  assert.equal((await packages.reconcile(request('A', '@ACME/ONE', 'legacy'))).status, 'applied');
  const { inspectRuntime } = await import('@bitakit/core');
  for (const id of ['first', 'second']) {
    const entry = inspectRuntime(runtime).static.plugins.find((plugin) => plugin.id === id);
    assert.equal(entry.package.name, 'legacy');
    assert.equal(entry.origin, 'package');
  }
  assert.throws(
    () =>
      createPackageHost({
        runtime,
        catalog: {
          DUPLICATE: { version: '1', load: async () => [] },
          duplicate: { version: '1', load: async () => [] },
        },
      }),
    /Duplicate catalog package identity/,
  );
});

test('catalog static identity conflicts with startup plugins before loading and validates loaded sets', async (t) => {
  let imports = 0;
  const { packages } = await host(
    t,
    {
      collision: {
        version: '1.0.0',
        pluginIds: ['keeper'],
        load: async () => {
          imports++;
          return [plugin('keeper')];
        },
      },
      mismatch: { version: '1.0.0', pluginIds: ['expected'], load: async () => [plugin('actual')] },
    },
    [plugin('keeper')],
  );
  assert.equal((await packages.reconcile(request('A', 'collision'))).status, 'blocked');
  assert.equal(imports, 0);
  const failed = await packages.reconcile(request('A', 'mismatch'));
  assert.equal(failed.status, 'failed');
  assert.match(failed.reasons.join(' '), /mismatch.*expected.*actual/);
});
