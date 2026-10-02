import type { ActionContext, ExecutionResult } from './types.js';

/** Returned by `before` to skip with reason "cancelled" (the user declined a confirmation). */
export const CANCEL: unique symbol = Symbol.for('bitakit.core.cancel');
export type ActionInterceptor = {
  /** Returning false cancels execution (reason "intercepted"); CANCEL skips with reason "cancelled". */
  before(
    context: ActionContext,
  ): boolean | void | typeof CANCEL | Promise<boolean | void | typeof CANCEL>;
};
export type ExecutionEvent = Readonly<{
  id: string;
  phase: 'started' | 'completed' | 'skipped' | 'failed';
  timestamp: number;
  context: ActionContext;
  result?: ExecutionResult;
  error?: unknown;
}>;
/** Interceptors gate commands; observers cannot change their outcome. */
export class ExecutionLifecycle {
  private interceptors = new Set<ActionInterceptor>();
  private observers = new Set<(event: ExecutionEvent) => void>();
  use(interceptor: ActionInterceptor) {
    this.interceptors.add(interceptor);
    return () => {
      this.interceptors.delete(interceptor);
    };
  }
  subscribe(listener: (event: ExecutionEvent) => void) {
    this.observers.add(listener);
    return () => {
      this.observers.delete(listener);
    };
  }
  /**
   * True to proceed, false when intercepted, CANCEL when a confirmation was declined. Stays
   * synchronous while every hook answers synchronously, so sync actions never show pending.
   */
  allow(context: ActionContext): boolean | typeof CANCEL | Promise<boolean | typeof CANCEL> {
    const pending = [...this.interceptors];
    const finish = async (
      first: Promise<boolean | void | typeof CANCEL>,
      rest: ActionInterceptor[],
    ) => {
      const verdict = await first;
      if (verdict === false) return false;
      if (verdict === CANCEL) return CANCEL;
      for (const interceptor of rest) {
        const next = await interceptor.before(context);
        if (next === false) return false;
        if (next === CANCEL) return CANCEL;
      }
      return true;
    };
    while (pending.length) {
      const interceptor = pending.shift()!;
      const verdict = interceptor.before(context);
      if (verdict && typeof (verdict as Promise<unknown>).then === 'function')
        return finish(verdict as Promise<boolean | void | typeof CANCEL>, pending);
      if (verdict === false) return false;
      if (verdict === CANCEL) return CANCEL;
    }
    return true;
  }
  get hasInterceptors() {
    return this.interceptors.size > 0;
  }
  emit(event: Omit<ExecutionEvent, 'timestamp'>) {
    const snapshot = Object.freeze({ ...event, timestamp: Date.now() });
    for (const listener of this.observers) {
      try {
        listener(snapshot);
      } catch {
        /* Diagnostics must not fail a successful mutation. */
      }
    }
  }
  clear() {
    this.interceptors.clear();
    this.observers.clear();
  }
}
