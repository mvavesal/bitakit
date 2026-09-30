import { ActionStatus } from './state.js';
import type { ActionSnapshot, ActionPatch, ActionContext, ExecutionResult } from './types.js';
import type { ExecutionLifecycle } from './interceptors.js';

export function createExecutor(
  setPending: (id: string, pending: boolean, status?: ActionStatus, error?: unknown) => void,
  owners: Map<string, symbol>,
  environment: unknown,
  get: (id: string) => ActionSnapshot | undefined,
  resolve: (id: string, input?: unknown) => ActionSnapshot | undefined,
  update: (id: string, patch: ActionPatch) => boolean,
  lifecycle: ExecutionLifecycle,
) {
  return async function execute(id: string, input?: unknown): Promise<ExecutionResult> {
    const owner = owners.get(id);
    const context: ActionContext = Object.freeze({
      id,
      input,
      environment,
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
    if (action.pending) return skip('pending');
    if (!action.execute) return skip('no-handler');
    let status = action.status;
    let failure = action.error;
    setPending(id, true, ActionStatus.Pending);
    lifecycle.emit({ id, context, phase: 'started' });
    try {
      if (lifecycle.hasInterceptors && !(await lifecycle.allow(context)))
        return skip('intercepted');
      if (owners.get(id) !== owner) return skip('replaced');
      const current = resolve(id, input);
      if (!current?.visible) return skip('hidden');
      if (!current.enabled) return skip('disabled');
      if (!current.execute) return skip('no-handler');
      // The handler's return value travels to the caller; it is never stored in action state.
      const value: unknown = await current.execute(context);
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
      if (owners.get(id) === owner && get(id)) {
        setPending(id, false, status, failure);
      }
    }
  };
}
