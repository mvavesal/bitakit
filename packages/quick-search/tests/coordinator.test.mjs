import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  createMemorySettingsStorage,
  defineService,
  settingsStorage,
  authService,
} from '@bitakit/core';
import { availableResult, searchService, sourceEnabled } from '../dist/service.js';
import { quickSearchSettings } from '../dist/settings.js';
import { searchSources } from '../dist/slots.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const result = (id) => ({ id, title: id, href: `/items/${id}` });
const source = (search, options = {}) => ({
  title: 'Catalog',
  description: 'Catalog entries',
  category: { id: 'catalog', title: 'Catalog' },
  defaultEnabled: true,
  search,
  resolve: (id) => result(id),
  ...options,
});
async function fixture(entries, storage = createMemorySettingsStorage()) {
  const handles = new Map();
  const runtime = createRuntime({
    plugins: [
      {
        id: 'quick-search',
        settings: quickSearchSettings,
        slots: { sources: searchSources },
        services: { search: searchService },
      },
      {
        id: 'catalog',
        setup({ scope }) {
          for (const [id, data] of Object.entries(entries))
            handles.set(
              id,
              scope.slots.attach(
                { slot: 'quick-search.sources', id, data },
                { availability: 'wait' },
              ),
            );
        },
      },
      {
        id: 'identity',
        services: {
          session: defineService(
            ({ store }) => {
              const state = store({
                user: null,
                organizationId: null,
                pending: false,
                error: null,
              });
              return {
                state,
                getSnapshot: state.get,
                subscribe: state.subscribe,
                async signOut() {
                  state.set({ user: null, pending: false, error: null });
                },
              };
            },
            { provides: authService },
          ),
        },
      },
      {
        id: 'storage',
        services: { storage: defineService(() => storage, { provides: settingsStorage }) },
      },
    ],
  });
  runtime.mount();
  await runtime.ready;
  const service = runtime.services['quick-search'].search;
  const request = (query = 'query', category = null) => ({
    query,
    category,
    identity: runtime.settings.currentIdentity,
    sources: runtime.slots
      .get('quick-search.sources')
      .items.map((item) => ({ id: item.id, plugin: item.plugin, source: item.data })),
    environment: {
      runtime,
      actions: runtime.actions,
      text: (value) => (typeof value === 'string' ? value : value.fallback),
      groupTitle: (group) => group.title ?? group.id,
      score: () => 1,
    },
  });
  const identity = async ({ userId, organizationId }) => {
    runtime.services.auth.state.set({
      user: userId ? { id: userId } : null,
      organizationId,
      pending: false,
      error: null,
    });
    await tick();
  };
  return { runtime, service, request, handles, storage, identity, stop: () => runtime.stop() };
}

test('ready results are incremental, failures isolated and disabled sources never invoked', async () => {
  const slow = deferred();
  let disabled = 0;
  const calls = [];
  const f = await fixture({
    fast: source(() => {
      calls.push('fast');
      return [result('fast')];
    }),
    slow: source(() => {
      calls.push('slow');
      return slow.promise;
    }),
    broken: source(() => {
      throw Error('private backend detail');
    }),
    off: source(
      () => {
        disabled++;
        return [];
      },
      { defaultEnabled: false },
    ),
  });
  try {
    f.service.search(f.request());
    await tick();
    const states = () =>
      Object.fromEntries(f.service.state.get().sources.map((item) => [item.source.id, item]));
    assert.deepEqual(calls, ['fast', 'slow']);
    assert.equal(disabled, 0);
    assert.equal(states()['catalog:fast'].results[0].id, 'fast');
    assert.equal(states()['catalog:slow'].status, 'loading');
    assert.equal(states()['catalog:broken'].status, 'error');
    assert.equal(
      JSON.stringify(f.service.state.get().sources).includes('private backend detail'),
      false,
    );
    slow.resolve([result('slow')]);
    await tick();
    assert.equal(states()['catalog:slow'].status, 'ready');
  } finally {
    await f.stop();
  }
});

test('query, category and preference changes abort old work, even sources ignoring the signal', async () => {
  const pending = [];
  const f = await fixture({
    catalog: source(({ signal, query }) => {
      const work = deferred();
      pending.push({ ...work, signal, query });
      return work.promise;
    }),
  });
  try {
    f.service.search(f.request('old'));
    await tick();
    f.service.search(f.request('new'));
    await tick();
    assert.equal(pending[0].signal.aborted, true);
    pending[0].resolve([result('stale')]);
    pending[1].resolve([result('fresh')]);
    await tick();
    assert.equal(f.service.state.get().sources[0].results[0].id, 'fresh');
    f.service.search(f.request('filter', 'other'));
    await tick();
    assert.equal(f.service.state.get().sources.length, 0);
    f.service.search(f.request('pending'));
    await tick();
    await f.runtime.settings.set('quick-search.sources', { 'catalog:catalog': false });
    assert.equal(pending[2].signal.aborted, true);
    f.service.search(f.request());
    await tick();
    assert.equal(pending.length, 3);
    pending[2].resolve([result('late')]);
    await tick();
    assert.equal(f.service.state.get().sources.length, 0);
  } finally {
    await f.stop();
  }
});

test('explicit user overrides win; a newly attached source uses only its own default', async () => {
  const f = await fixture({
    off: source(() => [], { defaultEnabled: false }),
    on: source(() => []),
  });
  try {
    await f.runtime.settings.set('quick-search.sources', {
      'catalog:off': true,
      'catalog:on': false,
    });
    const entries = f.request().sources;
    assert.equal(sourceEnabled(entries[0], f.runtime.settings.get('quick-search.sources')), true);
    assert.equal(sourceEnabled(entries[1], f.runtime.settings.get('quick-search.sources')), false);
    await f.runtime.plugins.add([
      {
        id: 'new',
        setup({ scope }) {
          scope.slots.attach(
            {
              slot: 'quick-search.sources',
              id: 'third',
              data: source(() => [], { defaultEnabled: false }),
            },
            { availability: 'wait' },
          );
        },
      },
    ]);
    const added = f.request().sources.find((item) => item.id === 'new:third');
    assert.equal(sourceEnabled(added, f.runtime.settings.get('quick-search.sources')), false);
    assert.deepEqual(f.runtime.settings.get('quick-search.sources'), {
      'catalog:off': true,
      'catalog:on': false,
    });
  } finally {
    await f.stop();
  }
});

test('detachment and runtime stop revoke in-flight results before cleanup settles', async () => {
  const work = deferred();
  let signal;
  const f = await fixture({
    catalog: source((ctx) => {
      signal = ctx.signal;
      return work.promise;
    }),
  });
  f.service.search(f.request());
  await tick();
  f.handles.get('catalog').dispose();
  assert.equal(signal.aborted, true);
  work.resolve([result('gone')]);
  await tick();
  assert.deepEqual(f.service.state.get().sources, []);
  await f.stop();
  assert.deepEqual(f.service.state.get().sources, []);
});

test('history stores references only and re-resolves current data/access without blocking search', async () => {
  const resolved = deferred();
  let resolveCount = 0;
  const f = await fixture({
    catalog: source(() => [result('ready')], {
      resolve(id) {
        resolveCount++;
        return resolved.promise;
      },
    }),
  });
  try {
    const req = f.request('lesson');
    await f.service.remember(req, 'catalog:catalog', result('previous'));
    const saved = f.runtime.settings.get('quick-search.history');
    assert.deepEqual(saved.queries, [{ query: 'lesson', organizationId: null }]);
    assert.deepEqual(saved.results, [
      { sourceId: 'catalog:catalog', resultId: 'previous', organizationId: null },
    ]);
    f.service.search(f.request(''));
    await tick();
    assert.equal(resolveCount, 1);
    assert.equal(f.service.state.get().sources[0].results[0].id, 'ready');
    assert.deepEqual(f.service.state.get().sources[0].recent, []);
    resolved.resolve(null);
    await tick();
    assert.deepEqual(f.service.state.get().sources[0].recent, []);
    await f.runtime.settings.set('quick-search.historyEnabled', false);
    await f.service.remember(f.request('ignored'), 'catalog:catalog', result('ignored'));
    assert.deepEqual(f.runtime.settings.get('quick-search.history'), saved);
    f.service.search(f.request(''));
    await tick();
    assert.equal(resolveCount, 1);
    await f.service.clearHistory();
    assert.deepEqual(f.runtime.settings.get('quick-search.history'), { queries: [], results: [] });
  } finally {
    await f.stop();
  }
});

test('user/organization changes cancel requests and separate recent queries and references', async () => {
  let resolves = 0;
  const work = deferred();
  let signal;
  const f = await fixture({
    catalog: source(
      (ctx) => {
        signal = ctx.signal;
        return work.promise;
      },
      {
        resolve(id) {
          resolves++;
          return result(id);
        },
      },
    ),
  });
  try {
    await f.identity({ userId: 'A', organizationId: 'one' });
    const oldRequest = f.request('private query');
    await f.service.remember(oldRequest, 'catalog:catalog', result('private'));
    f.service.search(f.request(''));
    await tick();
    assert.equal(resolves, 1);
    await f.identity({ userId: 'A', organizationId: 'two' });
    assert.equal(signal.aborted, true);
    f.service.search(f.request(''));
    await tick();
    assert.equal(resolves, 1);
    await f.identity({ userId: 'B', organizationId: 'one' });
    await f.service.remember(oldRequest, 'catalog:catalog', result('old-click'));
    assert.deepEqual(f.runtime.settings.get('quick-search.history'), { queries: [], results: [] });
    work.resolve([result('late')]);
    await tick();
    assert.deepEqual(f.service.state.get().sources, []);
  } finally {
    await f.stop();
  }
});

test('clear wins over queued saves and stale queued work never crosses an identity', async () => {
  const storage = createMemorySettingsStorage();
  const wait = deferred();
  let blocked = false;
  const f = await fixture(
    { catalog: source(() => []) },
    {
      ...storage,
      async save(key, value, context) {
        if (key === 'quick-search.history' && !blocked) {
          blocked = true;
          await wait.promise;
        }
        storage.save(key, value, context);
      },
    },
  );
  try {
    await f.identity({ userId: 'A' });
    const first = f.service.remember(f.request('one'), 'catalog:catalog', result('one'));
    await tick();
    const second = f.service.remember(f.request('two'), 'catalog:catalog', result('two'));
    const clear = f.service.clearHistory();
    await f.identity({ userId: 'B' });
    wait.resolve();
    await Promise.all([first, second, clear]);
    assert.deepEqual(f.runtime.settings.get('quick-search.history'), { queries: [], results: [] });
    assert.equal(storage.data.has('user:B/quick-search.history'), false);
    await f.service.remember(f.request('three'), 'catalog:catalog', result('three'));
    const last = f.service.remember(f.request('four'), 'catalog:catalog', result('four'));
    const cleared = f.service.clearHistory();
    await Promise.all([last, cleared]);
    assert.deepEqual(f.runtime.settings.get('quick-search.history'), { queries: [], results: [] });
  } finally {
    await f.stop();
  }
});

test('unsafe URLs and hidden/internal Actions are excluded; malformed source failures do not escape', async () => {
  const f = await fixture({
    unsafe: source(() => [
      result('okay'),
      { id: 'x', title: 'Unsafe', href: 'javascript:alert(1)' },
      { id: 'hidden', actionId: 'hidden' },
      { id: 'internal', actionId: 'internal' },
      { bad: true },
    ]),
    invalid: source(() => null),
  });
  try {
    f.runtime.actions.register({ id: 'hidden', title: 'Hidden', href: '/hidden', visible: false });
    f.runtime.actions.register({
      id: 'internal',
      title: 'Internal',
      href: '/internal',
      internal: true,
    });
    f.service.search(f.request());
    await tick();
    assert.deepEqual(
      f.service.state.get().sources[0].results.map((result) => result.id),
      ['okay'],
    );
    assert.equal(f.service.state.get().sources[1].status, 'error');
  } finally {
    await f.stop();
  }
});

test('link results keep a safe image and drop an unsafe one without losing the result', () => {
  const context = { actions: { resolve: () => undefined } };
  const cover = {
    id: 'c1',
    title: 'Course',
    href: '/courses/c1',
    image: { src: 'https://cdn.example/cover.webp', alt: 'Cover' },
  };
  assert.deepEqual(availableResult(cover, context), cover);
  const relative = { ...cover, image: { src: '/covers/c1.webp' } };
  assert.deepEqual(availableResult(relative, context), relative);
  const unsafe = availableResult({ ...cover, image: { src: 'javascript:alert(1)' } }, context);
  assert.deepEqual(unsafe, { id: 'c1', title: 'Course', href: '/courses/c1' });
  assert.equal(availableResult({ ...cover, image: { alt: 'no source' } }, context), null);
});
