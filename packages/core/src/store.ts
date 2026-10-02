import { createStore as createVanillaStore } from 'zustand/vanilla';

/**
 * Observable state owned by a service. `get` reads, `set` replaces (a value or an updater),
 * `subscribe` notifies after every change. Actions re-evaluate their presentation and
 * `useServiceState` re-renders when a store changes; services never notify by hand.
 */
export type Store<T> = {
  get(): T;
  set(update: T | ((current: T) => T)): void;
  subscribe(listener: (state: T, previous: T) => void): () => void;
  /**
   * Apply a change now, run the commit, and roll it back if the commit fails. The error is
   * rethrown so the calling action reports it. `reconcile` merges the committed value in.
   */
  optimistic<R>(
    apply: (current: T) => T,
    commit: () => Promise<R>,
    options?: { reconcile?: (current: T, result: R) => T; revert?: (current: T) => T },
  ): Promise<R>;
};

const marker = Symbol.for('bitakit.core.store');

export function createStore<T>(initial: T): Store<T> {
  const inner = createVanillaStore<T>(() => initial);
  const store: Store<T> = {
    get: inner.getState,
    set: (update) =>
      inner.setState(
        typeof update === 'function' ? (update as (current: T) => T) : () => update,
        true,
      ),
    subscribe: inner.subscribe,
    async optimistic(apply, commit, options = {}) {
      const previous = inner.getState();
      inner.setState(apply, true);
      const applied = inner.getState();
      try {
        const result = await commit();
        if (options.reconcile)
          inner.setState((current) => options.reconcile!(current, result), true);
        return result;
      } catch (error) {
        // Revert only this change when nothing else changed meanwhile; a custom revert otherwise.
        if (options.revert) inner.setState(options.revert, true);
        else if (inner.getState() === applied) inner.setState(() => previous, true);
        throw error;
      }
    },
  };
  Object.defineProperty(store, marker, { value: true });
  return store;
}

export function isStore(value: unknown): value is Store<unknown> {
  return !!value && typeof value === 'object' && (value as any)[marker] === true;
}

/** Anything a service exposes with `subscribe(listener)` is observed by the runtime. */
export function isObservable(
  value: unknown,
): value is { subscribe(listener: () => void): () => void } {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { subscribe?: unknown }).subscribe === 'function'
  );
}
