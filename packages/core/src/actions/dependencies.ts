import type { ActionSnapshot } from './types.js';

type Actions = Readonly<Record<string, ActionSnapshot>>;
export function freezeDependencies(ids?: readonly string[]) {
  return ids ? Object.freeze([...new Set(ids)]) : undefined;
}

/** Missing nodes and cycles fail closed. No dependency handler is executed. */
export function dependencyEnabled(
  id: string,
  actions: Actions,
  enabled: (action: ActionSnapshot) => boolean,
  visiting = new Set<string>(),
  cache = new Map<string, boolean>(),
): boolean {
  if (cache.has(id)) return cache.get(id)!;
  if (!Object.hasOwn(actions, id) || visiting.has(id)) return false;
  const action = actions[id];
  visiting.add(id);
  const result =
    enabled(action) &&
    (action.dependsOn ?? []).every((dependency) =>
      dependencyEnabled(dependency, actions, enabled, visiting, cache),
    );
  visiting.delete(id);
  cache.set(id, result);
  return result;
}

/** Invalidate contextual bindings too, even when their unbound enabled value stays the same. */
export function affectedActions(actions: Actions, changed: string): Set<string> {
  const affected = new Set([changed]);
  const dependents = new Map<string, string[]>();
  for (const action of Object.values(actions)) {
    for (const id of action.dependsOn ?? []) {
      const items = dependents.get(id) ?? [];
      items.push(action.id);
      dependents.set(id, items);
    }
  }
  for (const id of affected) {
    for (const dependent of dependents.get(id) ?? []) affected.add(dependent);
  }
  return affected;
}
