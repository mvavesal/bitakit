import equal from 'fast-deep-equal';
import { Cron } from 'croner';
import { getService, serviceKey, validate } from '@bitakit/core';
import { parseSchedules } from './sources.js';
import type {
  Schedule,
  ScheduleSource,
  SourceRegistration,
  TaskDefinition,
  Scheduler,
  SchedulerContext,
  SchedulerState,
  TaskContext,
} from './types.js';

const key = (id: string) => id.toLowerCase();
type Task = {
  definition: TaskDefinition<any, any>;
  context: Omit<TaskContext, 'input' | 'signal'>;
  active: boolean;
};
type Source = {
  source: ScheduleSource;
  snapshot: Schedule[];
  active: boolean;
  failed: boolean;
  queue: Promise<void>;
  unsubscribe?: () => void;
  handle: SourceRegistration;
};
type Timer = { schedule: Schedule; source: string; cron: Cron };
type Run = { task: Task; controller: AbortController; promise: Promise<unknown> };

/** In-process scheduler. The host must await stop; tasks must cooperate with their AbortSignal. */
export function createScheduler(
  context: SchedulerContext,
  options: {
    /** Manual engines are ready by default; the plugin binds this to Core lifecycle state. */
    initiallyReady?: boolean;
    /** Runtime integration re-enters the decorated public service method for automatic jobs. */
    dispatch?: (task: string, input: unknown, options: { schedule: string }) => Promise<unknown>;
    onError?: (error: unknown, origin: { source?: string; task?: string }) => void;
  } = {},
): Scheduler & { start(): Promise<void>; stop(): Promise<void>; setReady(ready: boolean): void } {
  const tasks = new Map<string, Task>();
  const sources = new Map<string, Source>();
  const timers = new Map<string, Timer>();
  const runs = new Set<Run>();
  const paused = new Map<string, boolean>();
  const state = context.store<SchedulerState>({ running: 0, schedules: [], sources: [] });
  let ready = options.initiallyReady ?? true;
  let nextRunId = 0;
  let started = false,
    stopped = false;
  let stopping: Promise<void> | undefined;
  let mutation = Promise.resolve();
  const assertOpen = () => {
    if (stopped) throw new Error('Scheduler is stopped.');
  };
  const report = (error: unknown, origin: { source?: string; task?: string }) => {
    try {
      (
        options.onError ??
        ((error, origin) => console.error('Scheduler operation failed.', origin, error))
      )(error, origin);
    } catch (failure) {
      console.error('Scheduler error reporter failed.', failure);
    }
  };
  const publish = () =>
    state.set({
      running: runs.size,
      schedules: [...timers.values()].map(({ schedule, source, cron }) =>
        Object.freeze({
          id: schedule.id,
          task: schedule.task,
          source,
          paused: !started || !ready || (paused.get(key(schedule.id)) ?? schedule.paused ?? false),
          nextRun: cron.nextRun()?.toISOString() ?? null,
        }),
      ),
      sources: [...sources.values()].map(({ source, failed }) => ({ id: source.id, failed })),
    });
  const serial = <T>(work: () => T | Promise<T>): Promise<T> => {
    const result = mutation.then(work);
    mutation = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const makeTimer = (schedule: Schedule, source: string) =>
    new Cron(
      schedule.cron ?? new Date(schedule.at!),
      {
        paused: true,
        timezone: schedule.timezone,
        protect: true,
        catch: (error) => report(error, { task: schedule.task }),
      },
      async () => {
        try {
          await (options.dispatch ?? execute)(schedule.task, schedule.input, {
            schedule: schedule.id,
          });
        } catch {
          /* execute reports the failure once and emits a sanitized event. */
        } finally {
          publish();
        }
      },
    );
  const reconcile = () => {
    if (stopped) return;
    const desired = new Map<string, { schedule: Schedule; source: string }>();
    const sorted = [...sources.values()]
      .filter((entry) => entry.active)
      .sort(
        (a, b) =>
          (a.source.priority ?? 0) - (b.source.priority ?? 0) ||
          (key(a.source.id) < key(b.source.id) ? -1 : key(a.source.id) > key(b.source.id) ? 1 : 0),
      );
    for (const entry of sorted)
      for (const schedule of entry.snapshot)
        desired.set(key(schedule.id), { schedule, source: entry.source.id });
    // Preflight every replacement before changing any active timer.
    const replacements = new Map<string, Timer>();
    try {
      for (const [id, next] of desired) {
        if (!tasks.has(key(next.schedule.task))) continue;
        const existing = timers.get(id);
        if (existing && equal(existing.schedule, next.schedule)) {
          existing.source = next.source;
          continue;
        }
        replacements.set(id, { ...next, cron: makeTimer(next.schedule, next.source) });
      }
    } catch (error) {
      for (const value of replacements.values()) value.cron.stop();
      throw error;
    }
    for (const [id, timer] of timers) {
      if (!desired.has(id) || !tasks.has(key(timer.schedule.task)) || replacements.has(id)) {
        timer.cron.stop();
        timers.delete(id);
        if (!desired.has(id)) paused.delete(id);
      }
    }
    for (const id of paused.keys()) if (!desired.has(id)) paused.delete(id);
    for (const [id, timer] of replacements) timers.set(id, timer);
    for (const [id, timer] of timers) {
      if (started && ready && !(paused.get(id) ?? timer.schedule.paused ?? false))
        timer.cron.resume();
      else timer.cron.pause();
    }
    publish();
  };
  const checkSnapshot = async (value: readonly Schedule[]) => {
    const snapshot = parseSchedules(value);
    const seen = new Set<string>();
    for (const schedule of snapshot) {
      const id = key(schedule.id);
      if (seen.has(id)) throw new Error(`Duplicate schedule "${schedule.id}" in source snapshot.`);
      seen.add(id);
      const task = tasks.get(key(schedule.task));
      if (!task) throw new Error(`Unknown task "${schedule.task}" in schedule "${schedule.id}".`);
      if (task.definition.input) await validate(task.definition.input, schedule.input);
      const probe = makeTimer(schedule, 'validation');
      probe.stop();
    }
    return snapshot;
  };
  const notify = (
    name: 'started' | 'completed' | 'failed',
    task: string,
    runId: number,
    schedule?: string,
  ) => {
    context.events.emit(`scheduler.${name}`, { task, runId, ...(schedule ? { schedule } : {}) });
  };
  async function execute(
    id: string,
    input?: unknown,
    runOptions?: { schedule?: string },
  ): Promise<unknown> {
    assertOpen();
    if (!ready) throw new Error('Scheduler runtime is not ready.');
    const runId = ++nextRunId;
    const schedule = runOptions?.schedule;
    const task = tasks.get(key(id));
    if (!task?.active) throw new Error(`Unknown task "${id}".`);
    const controller = new AbortController();
    // Track before invoking user code, including asynchronous validation.
    const run: Run = { task, controller, promise: Promise.resolve() };
    runs.add(run);
    run.promise = Promise.resolve().then(async () => {
      try {
        const checked = task.definition.input
          ? await validate(task.definition.input, input)
          : input;
        controller.signal.throwIfAborted();
        for (const name of task.definition.requires ?? [])
          getService(task.context.services, serviceKey(name));
        notify('started', id, runId, schedule);
        const result = await task.definition.execute({
          ...task.context,
          input: checked,
          signal: controller.signal,
        });
        notify('completed', id, runId, schedule);
        return result;
      } catch (error) {
        notify('failed', id, runId, schedule);
        report(error, { task: id });
        throw error;
      } finally {
        runs.delete(run);
        publish();
      }
    });
    publish();
    return run.promise;
  }
  const reloadEntry = (entry: Source): Promise<void> => {
    const result = entry.queue.then(async () => {
      if (!entry.active || stopped) return;
      try {
        const snapshot = await checkSnapshot(await entry.source.load());
        await serial(() => {
          if (!entry.active || stopped) return;
          const previous = entry.snapshot;
          entry.snapshot = snapshot;
          try {
            reconcile();
          } catch (error) {
            entry.snapshot = previous;
            throw error;
          }
          entry.failed = false;
          publish();
        });
      } catch (error) {
        if (entry.active && !stopped) {
          entry.failed = true;
          publish();
          report(error, { source: entry.source.id });
        }
        throw error;
      }
    });
    entry.queue = result.catch(() => {});
    return result;
  };
  const registerSource = (source: ScheduleSource): SourceRegistration => {
    assertOpen();
    const id = key(source.id);
    if (!id || sources.has(id)) throw new Error(`Duplicate or empty source ID "${source.id}".`);
    if (!Number.isFinite(source.priority ?? 0))
      throw new Error(`Invalid source priority for "${source.id}".`);
    let completion: Promise<void> | undefined;
    const entry: Source = {
      source,
      active: true,
      failed: false,
      snapshot: [],
      queue: Promise.resolve(),
      handle: undefined!,
    };
    const dispose = () => {
      if (completion) return completion;
      entry.active = false;
      sources.delete(id);
      // Revoke before awaiting I/O; old loads can never resurrect a registration.
      let error: unknown;
      try {
        entry.unsubscribe?.();
      } catch (failure) {
        error = failure;
      }
      reconcile();
      completion = entry.queue.then(() => {
        if (error) throw error;
      });
      return completion;
    };
    sources.set(id, entry);
    try {
      entry.unsubscribe = source.subscribe?.(() => {
        void reloadEntry(entry).catch(() => {});
      });
    } catch (error) {
      entry.active = false;
      sources.delete(id);
      throw error;
    }
    const ready = reloadEntry(entry);
    // The caller/startup still receives rejection; unawaited registration has an error reporter.
    void ready.catch(() => {});
    entry.handle = {
      ready,
      reload: () => reloadEntry(entry),
      dispose,
      [Symbol.asyncDispose]: dispose,
    };
    publish();
    return entry.handle;
  };
  return {
    state,
    setReady(value) {
      ready = value;
      reconcile();
    },
    registerTask(id, definition, taskContext = context) {
      assertOpen();
      if (!id || tasks.has(key(id))) throw new Error(`Duplicate or empty task ID "${id}".`);
      for (const name of definition.requires ?? [])
        getService(taskContext.services, serviceKey(name));
      const task: Task = { definition, context: taskContext, active: true };
      tasks.set(key(id), task);
      reconcile();
      let disposed: Promise<void> | undefined;
      return () => {
        if (disposed) return disposed;
        task.active = false;
        tasks.delete(key(id));
        reconcile();
        const pending = [...runs].filter((run) => run.task === task);
        for (const run of pending) run.controller.abort();
        disposed = Promise.allSettled(pending.map((run) => run.promise)).then(() => {});
        return disposed;
      };
    },
    registerSource,
    async reload(id) {
      assertOpen();
      if (id !== undefined) {
        const entry = sources.get(key(id));
        if (!entry) throw new Error(`Unknown source "${id}".`);
        await reloadEntry(entry);
      } else await Promise.all([...sources.values()].map(reloadEntry));
    },
    async unregisterSource(id) {
      await sources.get(key(id))?.handle.dispose();
    },
    registerSchedule(schedule, options) {
      return registerSource({
        id: `manual:${schedule.id}`,
        priority: options?.priority ?? 100,
        load: async () => [schedule],
      });
    },
    run: execute as Scheduler['run'],
    pause(id) {
      assertOpen();
      if (!timers.has(key(id))) throw new Error(`Unknown schedule "${id}".`);
      paused.set(key(id), true);
      timers.get(key(id))!.cron.pause();
      publish();
    },
    resume(id) {
      assertOpen();
      if (!timers.has(key(id))) throw new Error(`Unknown schedule "${id}".`);
      paused.set(key(id), false);
      if (started && ready) timers.get(key(id))!.cron.resume();
      publish();
    },
    list: () => state.get().schedules,
    async start() {
      assertOpen();
      await Promise.all([...sources.values()].map((entry) => entry.handle.ready));
      assertOpen();
      started = true;
      reconcile();
    },
    stop() {
      if (stopping) return stopping;
      stopped = true;
      started = false;
      for (const timer of timers.values()) timer.cron.stop();
      timers.clear();
      const handles = [...sources.values()].map((entry) => entry.handle);
      for (const run of runs) run.controller.abort();
      stopping = Promise.allSettled([
        ...handles.map((handle) => handle.dispose()),
        ...[...runs].map((run) => run.promise),
      ]).then((results) => {
        publish();
        const errors = results
          .slice(0, handles.length)
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map((result) => result.reason);
        if (errors.length) throw new AggregateError(errors, 'Scheduler source cleanup failed.');
      });
      return stopping;
    },
  };
}
