import type { ActionList } from './action-list.js';
import type { ActionInput, ActionResult, ExecutionResult } from './types.js';

declare const referenceType: unique symbol;
/** A typed handle to an existing registration; it stores no Action state. */
export interface ActionReference<Id extends string = string> {
  readonly [referenceType]: Id;
  readonly id: Id;
  execute(input?: ActionInput<Id>): Promise<ExecutionResult<ActionResult<Id>>>;
}
const owners = new WeakMap<object, { list: ActionList; id: string }>();

/** UI bindings reuse the current list and reject references from another app instance. */
export function resolveActionId<Id extends string>(
  target: Id | ActionReference<Id>,
  list: ActionList,
): Id {
  if (typeof target === 'string') return target;
  const owner = owners.get(target);
  if (!owner || owner.list !== list)
    throw new Error('The Action reference belongs to a different BitaKit instance.');
  return owner.id as Id;
}

/** Internal reference creation. Child paths provide namespaces without another Action registry. */
export function createActionReference(
  list: ActionList,
  id: string,
  children: { get(name: string): object; keys(): string[] },
): ActionReference {
  const target = Object.create(null);
  Object.defineProperties(target, {
    id: { value: id, configurable: true },
    execute: {
      configurable: true,
      value: (input?: unknown) => {
        if (list.get(id)?.internal)
          throw new Error(`Internal Action "${id}" is not publicly accessible.`);
        return list.execute(id, input);
      },
    },
  });
  const reference = new Proxy(target, {
    get(target, name, receiver) {
      if (Object.hasOwn(target, name)) return Reflect.get(target, name, receiver);
      if (typeof name !== 'string' || name === 'then' || name === 'toJSON') return undefined;
      return children.get(name);
    },
    ownKeys: children.keys,
    getOwnPropertyDescriptor: (target, name) =>
      Reflect.getOwnPropertyDescriptor(target, name) ??
      (typeof name === 'string' && children.keys().includes(name)
        ? { enumerable: true, configurable: true }
        : undefined),
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  }) as ActionReference;
  owners.set(reference, { list, id });
  return reference;
}
