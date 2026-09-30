import type { ActionContext, ExecutionResult } from './types.js';

export type ActionInterceptor = {
  /** Returning false cancels execution. Errors also prevent the handler from running. */
  before(context: ActionContext): boolean | void | Promise<boolean | void>;
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
  async allow(context: ActionContext) {
    for (const interceptor of [...this.interceptors]) {
      if ((await interceptor.before(context)) === false) return false;
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
