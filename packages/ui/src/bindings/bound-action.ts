import type { ActionList } from '@bitakit/core';
import type { ActionSnapshot, ExecutionResult } from '@bitakit/core';

export type BoundAction = ActionSnapshot & {
  disabled: boolean;
  run: (input?: unknown) => Promise<ExecutionResult>;
};
export function bindAction(
  list: ActionList,
  snapshot: ActionSnapshot,
  input: unknown,
): BoundAction {
  return {
    ...snapshot,
    disabled: !snapshot.enabled || snapshot.pending,
    run: (value = input) => list.execute(snapshot.id, value),
  };
}
