'use client';
import { useContext, useMemo, useSyncExternalStore, useEffect } from 'react';
import { useStore } from 'zustand';
import { ActionContext } from '../providers/action-context.js';
import type {
  ActionDefinition,
  ActionId,
  ActionInput,
  ActionResult,
  ActionSnapshot,
  ActionStateValue,
  ExecutionResult,
} from '@bitakit/core';
import type { Action } from '@bitakit/core';
import { resolveActionId, type ActionReference } from '@bitakit/core';

/** Resolved snapshot plus guarded execution; input and result follow ActionMap for known IDs. */
export type ActionState<Id extends string = string> = Omit<ActionSnapshot, 'execute' | 'state'> & {
  readonly state: ActionStateValue<Id>;
  execute(value?: ActionInput<Id>): Promise<ExecutionResult<ActionResult<Id>>>;
};

export function useActionList() {
  const list = useContext(ActionContext);
  if (!list) throw new Error('Action hooks require an ActionProvider.');
  return list;
}
export function useAction<Id extends ActionId>(
  target: Id | ActionReference<Id>,
  input?: ActionInput<Id>,
): ActionState<Id> | undefined {
  const list = useActionList();
  const id = resolveActionId(target, list);
  const snapshot = useStore(list, (state) =>
    Object.hasOwn(state.actions, id) ? state.actions[id] : undefined,
  );
  return useMemo(
    () =>
      snapshot
        ? {
            ...list.resolve(id, input)!,
            state: snapshot.state as ActionStateValue<Id>,
            execute: (value: ActionInput<Id> | undefined = input) => list.execute(id, value),
          }
        : undefined,
    [snapshot, list, id, input],
  );
}
/** Public registrations only; pass `{ internal: true }` to include helper registrations. */
export function useActions(options?: {
  internal?: boolean;
}): Readonly<Record<string, ActionSnapshot>> {
  const list = useActionList();
  const { actions } = useSyncExternalStore(list.subscribe, list.getState, list.getInitialState);
  const includeInternal = options?.internal ?? false;
  return useMemo(() => {
    if (includeInternal) return actions;
    const entries = Object.values(actions);
    if (!entries.some((action) => action.internal)) return actions;
    const visible: Record<string, ActionSnapshot> = Object.create(null);
    for (const action of entries) if (!action.internal) visible[action.id] = action;
    return visible;
  }, [actions, includeInternal]);
}
export function useRegisterAction(definition: ActionDefinition) {
  const list = useActionList();
  useEffect(() => list.register(definition).unregister, [list, definition]);
}

/** Optional page-owned registrations, with atomic setup and ownership-safe cleanup. */
export function useRegisterActions(definitions: readonly (ActionDefinition | Action<any, any>)[]) {
  const list = useActionList();
  useEffect(() => {
    const dispose: (() => void)[] = [];
    try {
      for (const definition of definitions) dispose.push(list.register(definition).unregister);
    } catch (error) {
      dispose.reverse().forEach((remove) => remove());
      throw error;
    }
    return () => {
      dispose.reverse().forEach((remove) => remove());
    };
  }, [list, definitions]);
}
