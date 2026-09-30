import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationRuntime,
  createActionList,
  defineService,
  defineAction,
  defineActionInterceptor,
  defineServiceInterceptor,
  discoverInterceptors,
  discoveredFile,
  discoverPublicServices,
  discoverServices,
} from '../dist/core.js';

function fixture(interceptors) {
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
  const files = [
    discoveredFile(defineService({ create: () => raw }), 'documents', 'services/documents.ts'),
  ];
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      {
        id: 'documents',
        services: discoverServices(files, 'documents'),
        publicServices: discoverPublicServices(files, 'documents'),
        interceptors,
        actions: [
          defineAction({
            id: 'documents.save',
            execute: ({ app }) => app.services.documents.save('Action'),
          }),
        ],
      },
    ],
  });
  const stop = runtime.mount();
  return { runtime, raw, stop };
}

test('mixed collections route Action and Service observers and preserve method contracts', async () => {
  const events = [];
  const interceptors = discoverInterceptors([
    discoveredFile(
      {
        actions: defineActionInterceptor({
          before: () => {
            events.push('action');
          },
        }),
        services: [
          defineServiceInterceptor({
            service: 'documents',
            method: 'save',
            before: ({ args }) => events.push(args[0]),
            after: ({ result }) => events.push(result.title),
          }),
          defineServiceInterceptor({
            service: 'documents',
            onError: ({ method, error }) => events.push(`${method}:${error.message}`),
          }),
        ],
      },
      'logging',
      'interceptors/logging.ts',
    ),
  ]);
  const { runtime, raw, stop } = fixture(interceptors);
  const service = runtime.app.services.documents;
  try {
    assert.equal(service, runtime.services['documents.documents']);
    assert.equal(service.save, service.save);
    assert.deepEqual(service.save('Direct'), { title: 'Direct', count: 1 });
    assert.deepEqual(events, ['Direct', 'Direct']);
    await runtime.app.actions.documents.save.execute();
    assert.deepEqual(events, ['Direct', 'Direct', 'action', 'Action', 'Action']);
    assert.equal(await service.load(), 2);
    assert.throws(() => service.remove(), /Cannot remove/);
    await assert.rejects(service.fail(), /Async failure/);
    assert.ok(events.includes('remove:Cannot remove'));
    assert.ok(events.includes('fail:Async failure'));
    const before = events.length;
    service.internal('Internal');
    raw.save('Raw');
    assert.equal(events.length, before);
  } finally {
    stop();
  }
  const before = events.length;
  service.save('Disposed');
  assert.equal(events.length, before);
});

test('observation retains Promise identity and cannot replace outcomes with callback errors', async () => {
  const result = Promise.resolve(42);
  const source = Object.freeze({ read: () => result });
  const files = [
    discoveredFile(defineService({ create: () => source }), 'source', 'services/source.ts'),
  ];
  const runtime = new FoundationRuntime(createActionList(), {
    publicServices: discoverPublicServices(files),
    services: discoverServices(files),
    interceptors: [
      defineServiceInterceptor({
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
    assert.equal(runtime.app.services.source.read(), result);
    assert.equal(await result, 42);
  } finally {
    stop();
  }
});
