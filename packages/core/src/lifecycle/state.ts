import { createStore } from '../store.js';

export type LifecyclePhase =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'blocked';
export type LifecycleFailure = Readonly<{ message: string; plugin?: string; source?: string }>;
export type LifecycleEntry = Readonly<{
  id: string;
  plugin: string;
  enabled: boolean;
  phase: LifecyclePhase;
  since: number;
  failure?: LifecycleFailure;
}>;
export type LifecycleSnapshot = Readonly<{
  generation: number;
  phase: LifecyclePhase;
  cleanup: 'none' | 'pending' | 'complete' | 'failed';
  operation: Readonly<{ kind: 'start' | 'stop' | 'update'; startedAt: number }> | null;
  plugins: readonly LifecycleEntry[];
  services: readonly LifecycleEntry[];
}>;
export type LifecycleState = Readonly<{
  get(): LifecycleSnapshot;
  subscribe(listener: (snapshot: LifecycleSnapshot) => void): () => void;
  /** Subscribes before delivering current state, so an already-ready owner is not missed. */
  watch(listener: (snapshot: LifecycleSnapshot) => void): () => void;
}>;

/** Observer failures are diagnostics, including callbacks that return rejected promises. */
export function notifyLifecycleObserver(call: () => unknown, report: (error: unknown) => void) {
  const failed = (error: unknown) => {
    try {
      report(error);
    } catch {
      /* reporting only */
    }
  };
  try {
    const result = call();
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(result).catch(failed);
  } catch (error) {
    failed(error);
  }
}

/** Status only; actual services and registrations remain owned by the existing runtime. */
export function createLifecycleState(
  pluginIds: readonly string[],
  services: readonly { id: string; plugin: string }[],
  publish: (snapshot: LifecycleSnapshot) => void,
  report: (error: unknown) => void,
) {
  const entry = (id: string, plugin: string): LifecycleEntry =>
    Object.freeze({ id, plugin, enabled: true, phase: 'idle', since: Date.now() });
  const store = createStore<LifecycleSnapshot>(
    Object.freeze({
      generation: 0,
      phase: 'idle',
      cleanup: 'none',
      operation: null,
      plugins: Object.freeze(pluginIds.map((id) => entry(id, id))),
      services: Object.freeze(services.map(({ id, plugin }) => entry(id, plugin))),
    }),
  );
  const call = (listener: (snapshot: LifecycleSnapshot) => void, value: LifecycleSnapshot) =>
    notifyLifecycleObserver(() => listener(value), report);
  const subscribe = (listener: (snapshot: LifecycleSnapshot) => void) =>
    store.subscribe((value) => call(listener, value));
  const state: LifecycleState = Object.freeze({
    get: store.get,
    subscribe,
    watch(listener) {
      const off = subscribe(listener);
      call(listener, store.get());
      return off;
    },
  });
  return {
    state,
    update(patch: Partial<LifecycleSnapshot>) {
      const current = store.get();
      const nextEntries = (
        entries: readonly LifecycleEntry[],
        previous: readonly LifecycleEntry[],
      ) =>
        Object.freeze(
          entries.map((item) => {
            const before = previous.find((entry) => entry.id === item.id);
            return before?.phase === item.phase
              ? item
              : Object.freeze({ ...item, since: Date.now() });
          }),
        );
      const next = Object.freeze({
        ...current,
        ...patch,
        ...(patch.plugins ? { plugins: nextEntries(patch.plugins, current.plugins) } : {}),
        ...(patch.services ? { services: nextEntries(patch.services, current.services) } : {}),
        ...(patch.phase && !['starting', 'stopping'].includes(patch.phase)
          ? { operation: null }
          : {}),
      });
      store.set(next);
      // A listener may request another transition; do not emit an obsolete snapshot afterward.
      if (store.get() === next) call(publish, next);
    },
    service(id: string, phase: LifecyclePhase, failure?: LifecycleFailure) {
      const current = store.get();
      const entries = current.services.map((item) =>
        item.id === id
          ? Object.freeze({ ...item, phase, failure: failure && Object.freeze({ ...failure }) })
          : item,
      );
      this.update({ services: Object.freeze(entries) });
    },
    plugin(id: string, phase: LifecyclePhase, failure?: LifecycleFailure) {
      this.update({
        plugins: Object.freeze(
          store.get().plugins.map((item) =>
            item.id === id
              ? Object.freeze({
                  ...item,
                  phase,
                  failure: failure && Object.freeze({ ...failure }),
                })
              : item,
          ),
        ),
      });
    },
  };
}

declare module '../events/types.js' {
  interface EventMap {
    'runtime.lifecycle': LifecycleSnapshot;
  }
}
