import { ActionStatus } from './state.js';
import type { ActionSnapshot, ActionPatch, ActionContext, ExecutionResult } from './types.js';
import { CANCEL, type ExecutionLifecycle } from './interceptors.js';

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value && typeof (value as PromiseLike<unknown>).then === 'function';
const keyOf = (action: ActionSnapshot, input: unknown) =>
  action.concurrency !== 'per-input'
    ? '*'
    : action.concurrencyKey
      ? action.concurrencyKey(input)
      : typeof input === 'object' && input !== null
        ? JSON.stringify(input)
        : String(input);

export function createExecutor(
  setPending: (
    id: string,
    key: string,
    pending: boolean,
    status?: ActionStatus,
    error?: unknown,
  ) => void,
  owners: Map<string, symbol>,
  environment: unknown,
  get: (id: string) => ActionSnapshot | undefined,
  resolve: (id: string, input?: unknown) => ActionSnapshot | undefined,
  update: (id: string, patch: ActionPatch) => boolean,
  lifecycle: ExecutionLifecycle,
  running: Map<string, Map<string, AbortController>>,
) {
  return async function execute(id: string, input?: unknown): Promise<ExecutionResult> {
    const owner = owners.get(id);
    const controller = new AbortController();
    const context: ActionContext = Object.freeze({
      id,
      input,
      environment,
      signal: controller.signal,
      get: () => (owners.get(id) === owner ? get(id) : undefined),
      update: (patch: ActionPatch) => owners.get(id) === owner && update(id, patch),
    });
    const skip = (
      reason: Extract<ExecutionResult, { status: 'skipped' }>['reason'],
    ): ExecutionResult => {
      const result = { status: 'skipped', reason } as const;
      lifecycle.emit({ id, context, phase: 'skipped', result });
      return result;
    };
    const action = resolve(id, input);
    if (!action) return skip('missing');
    if (!action.visible) return skip('hidden');
    if (!action.enabled) return skip('disabled');
    if (!action.execute) return skip('no-handler');
    const key = keyOf(action, input);
    let runs = running.get(id);
    if (!runs) running.set(id, (runs = new Map()));
    const previous = runs.get(key);
    if (previous) {
      if (action.concurrency !== 'latest') return skip('pending');
      previous.abort();
    }
    runs.set(key, controller);
    let pending = false;
    const markPending = () => {
      if (pending) return;
      pending = true;
      setPending(id, key, true, ActionStatus.Pending);
    };
    let status = action.status;
    let failure = action.error;
    lifecycle.emit({ id, context, phase: 'started' });
    try {
      if (lifecycle.hasInterceptors) {
        // Interceptors may wait (a confirmation); the action shows pending only then.
        let verdict = lifecycle.allow(context);
        if (isThenable(verdict)) {
          markPending();
          verdict = await verdict;
        }
        if (verdict === CANCEL) return skip('cancelled');
        if (!verdict) return skip('intercepted');
      }
      if (owners.get(id) !== owner) return skip('replaced');
      if (controller.signal.aborted) return skip('cancelled');
      const current = resolve(id, input);
      if (!current?.visible) return skip('hidden');
      if (!current.enabled) return skip('disabled');
      if (!current.execute) return skip('no-handler');
      // The handler's return value travels to the caller; it is never stored in action state.
      let value: unknown = current.execute(context);
      if (isThenable(value)) {
        markPending();
        value = await value;
      }
      status = ActionStatus.Succeeded;
      failure = undefined;
      const result = { status: 'completed', value } as const;
      lifecycle.emit({ id, context, phase: 'completed', result });
      return result;
    } catch (error) {
      status = ActionStatus.Failed;
      failure = error;
      lifecycle.emit({ id, context, phase: 'failed', error });
      throw error;
    } finally {
      // A run superseded by a newer `latest` run no longer owns its key: it must not clear the
      // pending flag or publish its outcome as the action's current state.
      const current = runs.get(key) === controller;
      if (current) runs.delete(key);
      if (!runs.size) running.delete(id);
      if (current && owners.get(id) === owner && get(id)) {
        if (pending) setPending(id, key, false, status, failure);
        else if (status !== get(id)!.status || failure !== get(id)!.error)
          setPending(id, key, false, status, failure);
      }
    }
  };
}
