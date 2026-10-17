import type { ActionList } from '../actions/action-list.js';
import { createActionReference } from '../actions/reference.js';
import type { BitaKitActions } from './types.js';

/** Projects dotted IDs onto stable handles; enumeration reads only current public registrations. */
export function createActionAccess(list: ActionList): BitaKitActions {
  const references = new Map<string, object>();
  const at = (path: string): object => {
    const cached = references.get(path);
    if (cached) return cached;
    const prefix = path ? `${path}.` : '';
    const reference = createActionReference(list, path, {
      get: (name) => at(`${prefix}${name}`),
      keys: () =>
        [
          ...new Set(
            Object.values(list.getState().actions)
              .filter((action) => !action.internal && action.id.startsWith(prefix))
              .map((action) => action.id.slice(prefix.length).split('.')[0]),
          ),
        ].filter(Boolean),
    });
    references.set(path, reference);
    return reference;
  };
  return at('') as BitaKitActions;
}
