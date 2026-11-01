import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, definePlugin, defineService } from '@bitakit/core';
import { createPackageHost } from '../dist/index.js';
const plugin = (id, value = 1, failure) =>
  definePlugin({
    id,
    services: {
      value: defineService(({ store, onStart, onStop }) => {
        onStart(() => {
          if (failure === 'start') throw Error('start failed');
        });
        onStop(() => {
          if (failure === 'stop') throw Error('stop failed');
        });
        return store(value);
      }),
    },
  });
const selection = (version = '1', name = 'notes') => ({ name, version });
const request = (version = '1', scope = 'A') => ({
  scope,
  packages: version ? [selection(version)] : [],
});
const memory = () => {
  let revision = 0,
    record = null;
  return {
    async read() {
      return { revision, record: structuredClone(record) };
    },
    async write(expected, next) {
      assert.equal(expected, revision);
      record = structuredClone(next);
      return ++revision;
    },
  };
};
async function setup(t, definitions, journal = memory(), extra = {}) {
  const runtime = createRuntime({ plugins: [plugin('keeper')] });
  const stop = runtime.mount();
  await runtime.ready;
  t.after(() => stop().catch(() => {}));
  const loads = [],
    disposed = [];
  const provider = {
    async resolve(s) {
      const item = definitions[s.version];
      if (!item) throw Error('download failed');
      return {
        artifact: {
          id: s.version,
          name: s.name.toLowerCase(),
          version: s.version,
          source: 'test:notes',
          pluginIds: item.ids ?? ['notes'],
        },
        load: async (signal) => {
          loads.push(s.version);
          if (item.wait) await item.wait;
          if (item.error) throw Error(item.error);
          return { plugins: item.make(), dispose: () => disposed.push(s.version) };
        },
      };
    },
  };
  const host = createPackageHost({
    runtime,
    dynamic: { provider, journal, dataCompatibility: 'unchanged', ...extra },
  });
  return { runtime, host, loads, disposed, journal };
}
const good = { make: () => [plugin('notes')] };

test('dynamic versions preserve unrelated state and retain the last known good selection', async (t) => {
  const { runtime, host, journal } = await setup(t, {
    1: good,
    2: { make: () => [plugin('notes', 2)] },
  });
  const keeper = runtime.services.keeper.value;
  keeper.set(88);
  assert.equal((await host.reconcile(request())).status, 'applied');
  assert.equal((await host.reconcile(request('2'))).status, 'applied');
  assert.equal(runtime.services.notes.value.get(), 2);
  assert.equal(runtime.services.keeper.value, keeper);
  assert.equal(keeper.get(), 88);
  assert.equal((await journal.read()).record.previous.packages[0].version, '1');
  await host.reconcile(request('2'));
  assert.equal((await journal.read()).record.previous.packages[0].version, '1');
  assert.equal((await host.reconcile(request(null))).status, 'applied');
  assert.equal(runtime.isReady('notes'), false);
});

test('fetch, static conflict, loaded identity and Core validation failures retain working services', async (t) => {
  const { runtime, host, loads } = await setup(t, {
    1: good,
    2: { ids: ['keeper'], make: () => [plugin('keeper')] },
    3: { make: () => [plugin('wrong')] },
    4: { make: () => [definePlugin({ id: 'notes', dependencies: ['missing'] })] },
  });
  await host.reconcile(request());
  const previous = runtime.services.notes.value;
  assert.equal((await host.reconcile(request('missing'))).status, 'failed');
  assert.equal((await host.reconcile(request('2'))).status, 'blocked');
  assert.deepEqual(loads, ['1']);
  assert.equal((await host.reconcile(request('3'))).status, 'failed');
  assert.equal((await host.reconcile(request('4'))).status, 'blocked');
  assert.equal(runtime.services.notes.value, previous);
});

test('a failing later member rolls back the whole package and disposes candidate resources', async (t) => {
  const { runtime, host, journal, disposed } = await setup(t, {
    1: good,
    2: { ids: ['notes', 'later'], make: () => [plugin('notes', 2), plugin('later', 0, 'start')] },
  });
  await host.reconcile(request());
  const result = await host.reconcile(request('2'));
  assert.equal(result.status, 'failed');
  assert.match(result.reasons.join(' '), /restored/);
  assert.equal(runtime.services.notes.value.get(), 1);
  assert.equal(runtime.isReady('later'), false);
  assert.equal((await journal.read()).record.active.packages[0].version, '1');
  assert.equal((await journal.read()).record.pending, undefined);
  assert.deepEqual(disposed, ['2']);
});

test('browser health failure restores the previous generation after Core readiness', async (t) => {
  let fail = false;
  const { runtime, host } = await setup(t, { 1: good, 2: good }, memory(), {
    health: async () => {
      if (fail) {
        fail = false;
        throw Error('render failure');
      }
    },
  });
  await host.reconcile(request());
  fail = true;
  const changed = await host.reconcile(request('2'));
  assert.equal(changed.status, 'failed');
  assert.equal(runtime.isReady('notes'), true);
  assert.equal(host.get().packages[0].version, '1');
});

test('cleanup failure blocks reuse and retains recovery intent', async (t) => {
  const { host, journal } = await setup(t, {
    1: { make: () => [plugin('notes', 1, 'stop')] },
    2: good,
  });
  await host.reconcile(request());
  const failed = await host.reconcile(request('2'));
  assert.equal(failed.status, 'failed');
  assert.match(failed.reasons.join(' '), /recovery failed/);
  assert.ok((await journal.read()).record.pending);
  assert.equal((await host.reconcile(request('2'))).status, 'blocked');
});

test('a fresh host recovers interrupted forward activation from retained predecessor bytes', async (t) => {
  const journal = memory();
  await journal.write(0, {
    active: { scope: 'A', packages: [{ ...selection(), artifact: '1' }] },
    pending: {
      before: { scope: 'A', packages: [{ ...selection(), artifact: '1' }] },
      after: { scope: 'A', packages: [{ ...selection('2'), artifact: '2' }] },
    },
  });
  const { host, runtime, loads } = await setup(t, { 1: good }, journal);
  assert.equal((await host.reconcile(request())).status, 'blocked');
  assert.equal((await host.recover()).status, 'applied');
  assert.deepEqual(loads, ['1']);
  assert.equal(runtime.isReady('notes'), true);
  assert.equal((await journal.read()).record.pending, undefined);
});

test('failed recovery never replaces persisted intent with an empty installation', async (t) => {
  const journal = memory();
  await journal.write(0, { active: { scope: 'A', packages: [{ ...selection(), artifact: '1' }] } });
  const { host } = await setup(t, { 1: { make: () => [plugin('notes', 1, 'start')] } }, journal);
  assert.equal((await host.recover()).status, 'failed');
  assert.equal((await journal.read()).record.active.packages[0].version, '1');
  assert.ok((await journal.read()).record.pending);
});

test('late preparation is discarded and cannot resurrect a superseded scope', async (t) => {
  let release;
  const wait = new Promise((resolve) => (release = resolve));
  const { host, runtime, disposed } = await setup(t, { 1: { ...good, wait }, 2: good });
  const first = host.reconcile(request());
  await new Promise((r) => setTimeout(r, 0));
  const second = host.reconcile(request('2', 'B'));
  assert.equal((await first).status, 'superseded');
  assert.equal((await second).status, 'applied');
  release();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(host.get().scope, 'B');
  assert.equal(runtime.isReady('notes'), true);
  assert.deepEqual(disposed, ['1']);
});

test('a failed candidate cleanup reports the scope that actually owns its retained definitions', async (t) => {
  const broken = () =>
    definePlugin({
      id: 'notes',
      services: {
        value: defineService(({ onStart, onStop }) => {
          onStart(() => {
            throw Error('candidate start');
          });
          onStop(() => {
            throw Error('candidate cleanup');
          });
          return {};
        }),
      },
    });
  const { host, runtime, journal } = await setup(t, { 1: good, 2: { make: () => [broken()] } });
  await host.reconcile(request());
  const failed = await host.reconcile(request('2', 'B'));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.scope, 'B');
  assert.equal(host.get().scope, 'B');
  assert.equal(host.get().packages[0].version, '2');
  assert.equal(runtime.isReady('notes'), false);
  assert.equal((await journal.read()).record.active.scope, 'A');
  assert.equal((await journal.read()).record.pending.after.scope, 'B');
});

test('failed first activation removes all candidate definitions and leaves no orphan package', async (t) => {
  const { host, runtime, journal, disposed } = await setup(t, {
    1: { make: () => [plugin('notes', 1, 'start')] },
  });
  const failed = await host.reconcile(request());
  assert.equal(failed.status, 'failed');
  assert.equal(
    runtime.config.plugins.some((p) => p.id === 'notes'),
    false,
  );
  assert.equal(host.get().packages.length, 0);
  assert.deepEqual(disposed, ['1']);
  assert.deepEqual((await journal.read()).record.active.packages, []);
});

test('an explicit recovery rechecks a previous generation whose UI health failed', async (t) => {
  let fail = false;
  const { host, journal, loads } = await setup(t, { 1: good, 2: good }, memory(), {
    health: async (ids) => {
      if (fail && ids.includes('notes')) throw Error('UI unhealthy');
    },
  });
  await host.reconcile(request());
  fail = true;
  const failed = await host.reconcile(request('2'));
  assert.match(failed.reasons.join(' '), /recovery failed/);
  assert.ok((await journal.read()).record.pending);
  assert.equal((await host.recover()).status, 'failed');
  assert.ok((await journal.read()).record.pending);
  fail = false;
  assert.equal((await host.recover()).status, 'applied');
  assert.equal((await journal.read()).record.pending, undefined);
  assert.deepEqual(loads, ['1', '2', '1', '1']);
});

test('resource visibility follows activation and rollback before health is checked', async (t) => {
  const visible = new Set();
  let fail = false;
  const runtime = createRuntime({});
  const stop = runtime.mount();
  await runtime.ready;
  t.after(() => stop());
  const provider = {
    async resolve(s) {
      return {
        artifact: {
          id: s.version,
          name: 'notes',
          version: s.version,
          source: 'fixture',
          pluginIds: ['notes'],
        },
        load: async () => ({
          plugins: [plugin('notes', Number(s.version))],
          activate: () => visible.add(s.version),
          deactivate: () => visible.delete(s.version),
          dispose: () => visible.delete(s.version),
        }),
      };
    },
  };
  const host = createPackageHost({
    runtime,
    dynamic: {
      provider,
      journal: memory(),
      dataCompatibility: 'unchanged',
      health: async () => {
        const version = String(runtime.services.notes.value.get());
        assert.deepEqual([...visible], [version]);
        if (fail && version === '2') throw Error('candidate health failure');
      },
    },
  });
  assert.equal((await host.reconcile(request())).status, 'applied');
  fail = true;
  assert.equal((await host.reconcile(request('2'))).status, 'failed');
  assert.deepEqual([...visible], ['1']);
  fail = false;
  assert.equal((await host.reconcile(request('2'))).status, 'applied');
  assert.deepEqual([...visible], ['2']);
});

test('resource disposal failure after commit keeps the actual new ownership and blocks reuse', async (t) => {
  const runtime = createRuntime({});
  const stop = runtime.mount();
  await runtime.ready;
  t.after(() => stop());
  const journal = memory();
  const provider = {
    async resolve(s) {
      return {
        artifact: {
          id: s.version,
          name: 'notes',
          version: s.version,
          source: 'fixture',
          pluginIds: ['notes'],
        },
        load: async () => ({
          plugins: [plugin('notes', Number(s.version))],
          dispose: () => {
            if (s.version === '1') throw Error('resource cleanup');
          },
        }),
      };
    },
  };
  const host = createPackageHost({
    runtime,
    dynamic: { provider, journal, dataCompatibility: 'unchanged' },
  });
  await host.reconcile(request());
  const changed = await host.reconcile(request('2'));
  assert.equal(changed.status, 'failed');
  assert.equal(runtime.services.notes.value.get(), 2);
  assert.equal(host.get().packages[0].version, '2');
  assert.equal((await journal.read()).record.active.packages[0].version, '2');
  assert.equal((await host.recover()).status, 'blocked');
});

test('disposing a session releases resources without uninstalling the durable selection', async (t) => {
  const journal = memory();
  const first = await setup(t, { 1: good }, journal);
  await first.host.reconcile(request());
  assert.equal((await first.host.dispose()).status, 'applied');
  assert.deepEqual(first.disposed, ['1']);
  assert.equal(first.runtime.isReady('notes'), false);
  assert.equal((await journal.read()).record.active.packages[0].version, '1');
  assert.equal((await first.host.reconcile(request())).status, 'blocked');
  assert.equal((await first.host.dispose()).status, 'applied');
  const second = await setup(t, { 1: good }, journal);
  assert.equal((await second.host.recover()).status, 'applied');
  assert.equal(second.runtime.isReady('notes'), true);
});

test('a disposed host releases styles after successful Core shutdown and cannot activate late imports', async (t) => {
  const first = await setup(t, { 1: good });
  await first.host.reconcile(request());
  await first.runtime.stop();
  assert.equal((await first.host.dispose()).status, 'applied');
  assert.deepEqual(first.disposed, ['1']);
  let release;
  const wait = new Promise((resolve) => (release = resolve));
  const second = await setup(t, { 1: { ...good, wait } });
  const pending = second.host.reconcile(request());
  await new Promise((resolve) => setTimeout(resolve, 0));
  const disposal = second.host.dispose();
  assert.equal((await pending).status, 'superseded');
  assert.equal((await disposal).status, 'applied');
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(second.runtime.isReady('notes'), false);
  assert.deepEqual(second.disposed, ['1']);
});
