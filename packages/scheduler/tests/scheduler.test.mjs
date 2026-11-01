import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  createStore,
  ConfigService,
  EventService,
  createRuntime,
  definePlugin,
  discoveredFile,
} from '@bitakit/core';
import {
  createScheduler,
  defineTask,
  defineSchedule,
  discoverTasks,
  discoverSchedules,
  schedulerPlugin,
  urlSource,
} from '../dist/index.js';
import { fileSource } from '../dist/server/index.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function fixture(t) {
  const errors = [],
    events = new EventService(),
    notices = [];
  events.observe((event) => notices.push(event));
  const engine = createScheduler(
    {
      services: {},
      settings: {},
      config: new ConfigService([{ id: 'app' }]).context('app'),
      events,
      store: createStore,
    },
    { onError: (e) => errors.push(e) },
  );
  t.after(() => engine.stop());
  engine.registerTask(
    'reports.weekly',
    defineTask({ input: z.object({ n: z.number() }), execute: ({ input }) => input.n * 2 }),
  );
  return { engine, errors, notices };
}
const schedule = (extra = {}) => ({
  id: 'weekly',
  task: 'REPORTS.WEEKLY',
  cron: '0 0 * * *',
  input: { n: 2 },
  ...extra,
});

test('all invocation paths validate input and events contain no input/results', async (t) => {
  const { engine, notices } = fixture(t);
  assert.equal(await engine.run('REPORTS.WEEKLY', { n: 3 }), 6);
  await assert.rejects(engine.run('reports.weekly', { n: 'invalid' }));
  assert.deepEqual(
    notices.map((e) => e.type),
    ['scheduler.started', 'scheduler.completed', 'scheduler.failed'],
  );
  assert.ok(
    notices.every((e) => !('input' in e.data) && !('result' in e.data) && !('error' in e.data)),
  );
});

test('priority overrides, case-insensitive IDs, removal restores defaults', async (t) => {
  const { engine } = fixture(t);
  const base = engine.registerSource({
    id: 'defaults',
    priority: -100,
    load: async () => [schedule()],
  });
  const high = engine.registerSource({
    id: 'host',
    priority: 20,
    load: async () => [schedule({ id: 'WEEKLY', paused: true })],
  });
  await Promise.all([base.ready, high.ready]);
  await engine.start();
  assert.equal(engine.list().length, 1);
  assert.equal(engine.list()[0].source, 'host');
  assert.equal(engine.list()[0].paused, true);
  await high.dispose();
  assert.equal(engine.list()[0].source, 'defaults');
  engine.pause('WEEKLY');
  assert.equal(engine.list()[0].paused, true);
  engine.resume('wEeKlY');
  assert.equal(engine.list()[0].paused, false);
});

test('invalid snapshots retain active schedules and report errors', async (t) => {
  const { engine, errors } = fixture(t);
  let value = [schedule()];
  const source = engine.registerSource({ id: 'data', load: async () => value });
  await source.ready;
  for (const bad of [
    [schedule({ cron: 'bad cron' })],
    [schedule({ timezone: 'Invalid/Zone' })],
    [schedule({ input: { n: 'bad' } })],
    [schedule({ task: 'missing' })],
    [schedule(), schedule({ id: 'WEEKLY' })],
  ]) {
    value = bad;
    await assert.rejects(source.reload());
    assert.equal(engine.list().length, 1);
  }
  assert.equal(errors.length, 5);
  assert.equal(engine.state.get().sources[0].failed, true);
  value = [];
  await source.reload();
  assert.equal(engine.list().length, 0);
});

test('source loads serialize and disposal cannot resurrect an old snapshot', async (t) => {
  const { engine } = fixture(t);
  const gate = deferred();
  let calls = 0,
    subscribed = 0;
  const source = engine.registerSource({
    id: 'remote',
    load: async () => {
      calls++;
      await gate.promise;
      return [schedule()];
    },
    subscribe: () => {
      subscribed++;
      return () => subscribed--;
    },
  });
  const second = source.reload();
  await Promise.resolve();
  assert.equal(calls, 1);
  const stopping = source.dispose();
  gate.resolve();
  await Promise.all([source.ready, second, stopping]);
  assert.equal(calls, 1);
  assert.equal(subscribed, 0);
  assert.equal(engine.list().length, 0);
});

test('stop aborts active jobs, awaits their cleanup and is idempotent', async (t) => {
  const { engine } = fixture(t);
  const entered = deferred(),
    release = deferred();
  let aborted = false;
  engine.registerTask(
    'long',
    defineTask({
      execute: async ({ signal }) => {
        entered.resolve();
        await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        aborted = true;
        await release.promise;
      },
    }),
  );
  const run = engine.run('long');
  await entered.promise;
  const stop = engine.stop();
  assert.equal(stop, engine.stop());
  await Promise.resolve();
  assert.equal(aborted, true);
  let done = false;
  void stop.then(() => (done = true));
  await Promise.resolve();
  assert.equal(done, false);
  release.resolve();
  await Promise.all([run, stop]);
  await assert.rejects(engine.run('long'), /stopped/);
});

test('runtime contributions use the contributing event owner and config, and drain at stop', async () => {
  const tasks = discoverTasks(
    [
      discoveredFile(
        defineTask({
          execute: ({ events, config }) => {
            events.emit('reports.done');
            return config.plugin.get('answer');
          },
        }),
        'weekly',
        'weekly.ts',
      ),
    ],
    'reports',
  );
  const { defineEvents, event } = await import('@bitakit/core');
  const runtime = createRuntime({
    plugins: [
      schedulerPlugin,
      definePlugin({
        id: 'reports',
        events: defineEvents({ done: event() }),
        config: { answer: 42 },
        contributions: { 'scheduler.tasks': tasks },
      }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    assert.equal(await runtime.services.scheduler.run('reports.weekly'), 42);
  } finally {
    await stop();
  }
});

test('folder, dotted and record declarations share normalizers', () => {
  const task = defineTask({ execute() {} });
  assert.equal(
    discoverTasks([discoveredFile({ weekly: task }, '', 'tasks.ts')], 'reports')[0].id,
    'reports.weekly',
  );
  assert.equal(
    discoverTasks([discoveredFile(task, 'team.weekly', 'tasks/team/weekly.ts')], 'reports')[0].id,
    'reports.team.weekly',
  );
  assert.equal(
    discoverSchedules(
      [
        discoveredFile(
          defineSchedule({ task: 'reports.weekly', cron: '* * * * *' }),
          'weekly',
          'schedules.weekly.ts',
        ),
      ],
      'reports',
    )[0].id,
    'reports.weekly',
  );
});

test('Node YAML files reload at runtime; URL sources reject bad HTTP responses', async (t) => {
  const { engine } = fixture(t);
  const directory = await mkdtemp(join(tmpdir(), 'bitakit-scheduler-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'jobs.yaml');
  await writeFile(
    path,
    '- id: weekly\n  task: reports.weekly\n  cron: "0 0 * * *"\n  input:\n    n: 2\n',
  );
  const handle = engine.registerSource(fileSource({ id: 'file', path, watch: false }));
  await handle.ready;
  assert.equal(engine.list().length, 1);
  await writeFile(path, '[]');
  await engine.reload('FILE');
  assert.equal(engine.list().length, 0);
  await assert.rejects(
    urlSource({
      id: 'url',
      url: 'https://example.test/jobs',
      fetch: async () => new Response('', { status: 503 }),
    }).load(),
    /503/,
  );
});

test('automatic and manual execution cross the same existing service interceptor exactly once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2030-01-01T00:00:00Z') });
  const { defineInterceptor } = await import('@bitakit/core');
  const traces = [];
  const observer = definePlugin({
    id: 'audit',
    interceptors: [
      defineInterceptor({
        service: 'SCHEDULER',
        method: 'run',
        before: (call) =>
          traces.push(['before', call.callId, call.args[0], call.args[2]?.schedule]),
        after: (call) => traces.push(['after', call.callId, call.result, call.durationMs]),
        onError: (call) => traces.push(['error', call.callId]),
      }),
    ],
  });
  const runtime = createRuntime({ plugins: [schedulerPlugin, observer] });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    const service = runtime.services.scheduler;
    service.registerTask('reports.send', defineTask({ execute: async () => 42 }));
    await service.run('reports.send');
    const done = deferred();
    runtime.events.on('scheduler.completed', () => done.resolve());
    await service.registerSchedule({ id: 'once', task: 'reports.send', at: '2030-01-01T00:00:01Z' })
      .ready;
    t.mock.timers.tick(1100);
    await done.promise;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(traces.filter(([phase]) => phase === 'before').length, 2);
    assert.equal(traces.filter(([phase]) => phase === 'after').length, 2);
    assert.equal(traces[0][1], traces[1][1]);
    assert.equal(traces[2][1], traces[3][1]);
    assert.equal(traces[2][3], 'once');
    assert.equal(traces[3][2], 42);
    assert.ok(traces[3][3] >= 0);
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(traces.length, 4);
  } finally {
    await stop();
  }
});

test('unchanged reloads retain one-shot completion and pause state', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2030-01-01T00:00:00Z') });
  const { engine } = fixture(t);
  let runs = 0;
  engine.registerTask('count', defineTask({ execute: () => runs++ }));
  const handle = engine.registerSource({
    id: 'once',
    load: async () => [{ id: 'one', task: 'count', at: '2030-01-01T00:00:01Z' }],
  });
  await handle.ready;
  await engine.start();
  t.mock.timers.tick(1100);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runs, 1);
  await handle.reload();
  t.mock.timers.tick(1000);
  await Promise.resolve();
  assert.equal(runs, 1);
});

test('runtime startup gates timers and manual calls until required services finish starting', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2030-01-01T00:00:00Z') });
  const { defineService } = await import('@bitakit/core');
  const gate = deferred();
  let count = 0;
  const runtime = createRuntime({
    plugins: [
      schedulerPlugin,
      definePlugin({
        id: 'slow',
        services: {
          ready: defineService(({ onStart }) => {
            onStart(() => gate.promise);
            return {};
          }),
        },
        contributions: {
          'scheduler.tasks': [
            {
              id: 'slow.task',
              definition: defineTask({ requires: ['slow.ready'], execute: () => count++ }),
            },
          ],
          'scheduler.schedules': [{ id: 'tick', task: 'slow.task', cron: '* * * * * *' }],
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    await assert.rejects(runtime.services.scheduler.run('slow.task'), /not ready/);
    t.mock.timers.tick(2000);
    await Promise.resolve();
    assert.equal(count, 0);
    gate.resolve();
    await runtime.ready;
    t.mock.timers.tick(1100);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(count, 1);
    await stop();
    t.mock.timers.tick(10000);
    await Promise.resolve();
    assert.equal(count, 1);
  } finally {
    gate.resolve();
    await stop();
  }
});

test('file source observes atomic YAML replacement without source-code changes', async (t) => {
  const { engine } = fixture(t);
  const directory = await mkdtemp(join(tmpdir(), 'bitakit-scheduler-watch-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'jobs.yaml');
  await writeFile(
    path,
    '- id: weekly\n  task: reports.weekly\n  cron: "0 0 * * *"\n  input:\n    n: 2\n',
  );
  const handle = engine.registerSource(fileSource({ id: 'watched', path }));
  await handle.ready;
  const changed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      reject(new Error('File watcher did not reload'));
    }, 3000);
    const off = engine.state.subscribe((state) => {
      if (!state.schedules.length) {
        clearTimeout(timeout);
        off();
        resolve();
      }
    });
  });
  await writeFile(join(directory, 'replacement.yaml'), '[]');
  await rename(join(directory, 'replacement.yaml'), path);
  await changed;
  assert.equal(engine.list().length, 0);
  await handle.dispose();
});

test('manual task replacement restores retained schedules and removed schedules drop pause overrides', async (t) => {
  const { engine } = fixture(t);
  const remove = engine.registerTask('replaceable', defineTask({ execute: () => 1 }));
  const source = engine.registerSource({
    id: 'replaceable',
    load: async () => [{ id: 'replaceable', task: 'replaceable', cron: '0 0 * * *' }],
  });
  await source.ready;
  await engine.start();
  engine.pause('replaceable');
  await remove();
  assert.equal(engine.list().length, 0);
  await source.dispose();
  engine.registerTask('replaceable', defineTask({ execute: () => 2 }));
  const replacement = engine.registerSchedule({
    id: 'replaceable',
    task: 'replaceable',
    cron: '0 0 * * *',
  });
  await replacement.ready;
  assert.equal(engine.list()[0].paused, false);
});
