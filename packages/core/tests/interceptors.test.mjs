import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL,
  createRuntime,
  defineAction,
  defineInterceptor,
  definePlugin,
  defineService,
  isBitaKitStartupError,
  isServiceInterceptor,
  matchesTarget,
} from '../dist/core.js';

const plugin = (id, interceptors = []) =>
  definePlugin({
    id,
    interceptors,
    actions: {
      run: defineAction({ execute: ({ input }) => `${id}:${input ?? ''}` }),
      fail: defineAction({
        execute: () => {
          throw new Error(`${id} failed`);
        },
      }),
    },
  });

test('action interceptors match by glob within their plugin by default; app-level and scope: global see every plugin', async () => {
  const log = [];
  const runtime = createRuntime({
    interceptors: [defineInterceptor({ before: ({ id }) => void log.push(`app:${id}`) })],
    plugins: [
      plugin('todos', [
        defineInterceptor({
          action: 'todos.*',
          before: ({ id, input }) => void log.push(`todos:${id}:${input}`),
        }),
        defineInterceptor({
          action: '*',
          scope: 'global',
          before: ({ id }) => void log.push(`global:${id}`),
        }),
        defineInterceptor({ before: ({ id }) => void log.push(`own:${id}`) }),
      ]),
      plugin('notes'),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal((await runtime.actions.execute('todos.run', 1)).value, 'todos:1');
    assert.equal((await runtime.actions.execute('notes.run', 2)).value, 'notes:2');
    assert.deepEqual(log, [
      'app:todos.run',
      'todos:todos.run:1',
      'global:todos.run',
      'own:todos.run',
      'app:notes.run',
      'global:notes.run',
    ]);
  } finally {
    await stop();
  }
  assert.equal(matchesTarget('todos.*', 'todos.run'), true);
  assert.equal(matchesTarget('todos.*', 'todosx.run'), false);
  assert.equal(matchesTarget(['a', 'b.*'], 'b.c'), true);
  assert.equal(matchesTarget('*', 'anything'), true);
});

test('before gates (false → intercepted, CANCEL → cancelled); after and onError observe outcomes in order', async () => {
  const log = [];
  let verdict = true;
  const runtime = createRuntime({
    plugins: [
      plugin('todos', [
        defineInterceptor({
          action: ['todos.run', 'todos.fail'],
          order: 10,
          before: () => {
            log.push('second');
            return verdict;
          },
          after: ({ id, result }) => void log.push(`after:${id}:${result}`),
          onError: ({ id, error }) =>
            void log.push(`error:${id}:${(error.cause ?? error).message}`),
        }),
        defineInterceptor({ action: 'todos.run', order: -1, before: () => void log.push('first') }),
      ]),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.deepEqual(await runtime.actions.execute('todos.run', 'a'), {
      status: 'completed',
      value: 'todos:a',
    });
    assert.deepEqual(log, ['first', 'second', 'after:todos.run:todos:a']);
    log.length = 0;
    verdict = false;
    assert.deepEqual(await runtime.actions.execute('todos.run'), {
      status: 'skipped',
      reason: 'intercepted',
    });
    verdict = CANCEL;
    assert.deepEqual(await runtime.actions.execute('todos.run'), {
      status: 'skipped',
      reason: 'cancelled',
    });
    assert.deepEqual(log, ['first', 'second', 'first', 'second']);
    assert.equal(runtime.actions.get('todos.run').pending, false);
    log.length = 0;
    verdict = true;
    await assert.rejects(
      runtime.actions.execute('todos.fail'),
      (error) => error.cause.message === 'todos failed',
    );
    assert.deepEqual(log, ['second', 'error:todos.fail:todos failed']);
  } finally {
    await stop();
  }
});

test('async before hooks are awaited and the guards are re-checked afterwards', async () => {
  let release;
  const runtime = createRuntime({
    plugins: [
      plugin('todos', [
        defineInterceptor({
          before: () =>
            new Promise((resolve) => {
              release = resolve;
            }),
        }),
      ]),
    ],
  });
  const stop = runtime.mount();
  try {
    const running = runtime.actions.execute('todos.run');
    assert.equal(
      runtime.actions.get('todos.run').pending,
      true,
      'a waiting interceptor shows pending',
    );
    runtime.actions.update('todos.run', { enabled: false });
    release(true);
    assert.deepEqual(await running, { status: 'skipped', reason: 'disabled' });
    assert.equal(runtime.actions.get('todos.run').pending, false);
  } finally {
    await stop();
  }
});

test('service interceptors observe method calls by ID or alias without changing outcomes', async () => {
  const log = [];
  class Documents {
    #count = 0;
    save(title) {
      return { title, count: ++this.#count };
    }
    remove() {
      throw new Error('Cannot remove');
    }
    async load() {
      return this.#count;
    }
    async fail() {
      throw new Error('Async failure');
    }
    internal(title) {
      return this.save(title);
    }
  }
  const raw = new Documents();
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'documents',
        services: { store: defineService(() => raw, { exposeAs: 'docs' }) },
        interceptors: [
          defineInterceptor({
            service: 'documents.store',
            method: 'save',
            before: ({ service, method, args }) =>
              void log.push(`before:${service}:${method}:${args[0]}`),
            after: ({ result }) => void log.push(`after:${result.title}:${result.count}`),
          }),
          defineInterceptor({
            service: 'docs',
            onError: ({ method, error }) => void log.push(`${method}:${error.message}`),
          }),
        ],
        actions: {
          save: defineAction({
            execute: ({ services }) => services.documents.store.save('Action'),
          }),
        },
      }),
    ],
  });
  const stop = runtime.mount();
  const service = runtime.services.documents.store;
  try {
    assert.notEqual(service, raw);
    assert.equal(runtime.services.docs, service);
    assert.equal(service.save, service.save, 'wrapped methods keep their identity');
    assert.deepEqual(service.save('Direct'), { title: 'Direct', count: 1 });
    assert.deepEqual(log, ['before:documents.store:save:Direct', 'after:Direct:1']);
    await runtime.actions.execute('documents.save');
    assert.deepEqual(log.slice(2), ['before:documents.store:save:Action', 'after:Action:2']);
    assert.equal(await service.load(), 2);
    assert.throws(() => service.remove(), /Cannot remove/);
    await assert.rejects(service.fail(), /Async failure/);
    await Promise.resolve();
    assert.ok(log.includes('remove:Cannot remove'));
    assert.ok(log.includes('fail:Async failure'));
    const before = log.length;
    service.internal('Internal');
    raw.save('Raw');
    assert.equal(log.length, before, 'calls that bypass the public surface are not observed');
  } finally {
    await stop();
  }
  const before = log.length;
  service.save('Disposed');
  assert.equal(log.length, before, 'observers stop with the runtime');
});

test('observer failures and frozen instances never change the service outcome; Promise identity is kept', async () => {
  const result = Promise.resolve(42);
  const source = Object.freeze({ read: () => result });
  const runtime = createRuntime({
    services: { source: defineService(() => source) },
    interceptors: [
      defineInterceptor({
        service: 'source',
        before() {
          throw new Error('Observer');
        },
        after: async () => {
          throw new Error('Observer');
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    assert.equal(runtime.services.source.read(), result);
    assert.equal(await result, 42);
  } finally {
    await stop();
  }
});

test('an interceptor targets actions or a service, never both; requires are checked at startup', async () => {
  assert.throws(
    () => defineInterceptor({ action: 'a', service: 'b', before() {} }),
    /either actions or a service/,
  );
  assert.throws(() => defineInterceptor(), /expects an object/);
  const own = defineInterceptor({ before() {} });
  assert.equal(own.action, '*');
  assert.equal(own.kind, 'interceptor');
  assert.equal(isServiceInterceptor(own), false);
  assert.equal(isServiceInterceptor(defineInterceptor({ service: 'x', before() {} })), true);
  const runtime = createRuntime({
    plugins: [plugin('todos', [defineInterceptor({ requires: ['todos.missing'], before() {} })])],
  });
  assert.throws(
    () => runtime.mount(),
    (error) =>
      isBitaKitStartupError(error) &&
      error.plugin === 'todos' &&
      /An interceptor in plugin "todos" requires service "todos\.missing", but no service has that name/.test(
        error.message,
      ),
  );
});

test('action interceptors receive services, the target action config, the app and a translator', async () => {
  let seen;
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'todos',
        config: { actions: { run: { limit: 3 } } },
        services: { tasks: defineService(() => ({ size: () => 1 })) },
        interceptors: [
          defineInterceptor({
            before: (context) => {
              seen = {
                id: context.id,
                input: context.input,
                limit: context.config.action.get('limit'),
                size: context.services.todos.tasks.size(),
                app: typeof context.app.has,
                text: context.translate('todos.run.title'),
                has: typeof context.translate.has,
              };
            },
          }),
        ],
        actions: { run: defineAction({ execute: () => 'ok' }) },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    await runtime.actions.execute('todos.run', 'in');
    assert.deepEqual(seen, {
      id: 'todos.run',
      input: 'in',
      limit: 3,
      size: 1,
      app: 'function',
      text: 'todos.run.title',
      has: 'function',
    });
  } finally {
    await stop();
  }
});
