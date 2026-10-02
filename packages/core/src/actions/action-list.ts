import { ActionStatus } from './state.js';
import { freezeGroups, type RegistrationOptions } from './groups.js';
import { ExecutionLifecycle } from './interceptors.js';
import { createExecutor } from './execution.js';
import { createStore } from 'zustand/vanilla';
import { NavigationHost, safeHref } from './navigation.js';
import { InstanceBindings } from './instance-bindings.js';
import { Action } from './action.js';
import { isBrandedInstance } from './brand.js';
import { affectedActions, dependencyEnabled, freezeDependencies } from './dependencies.js';
import type {
  ActionDefinition,
  ActionSnapshot,
  ActionPatch,
  ActionContext,
  ActionRegistration,
  ActionId,
  ActionInput,
  ActionResult,
  ExecutionResult,
} from './types.js';

type State = { actions: Readonly<Record<string, ActionSnapshot>> };

/** No global state. This can also be used outside React. */
export function createActionList(
  initialActions: readonly (ActionDefinition | Action<any, any>)[] = [],
  options: {
    environment?: unknown;
    validate?: (action: ActionSnapshot, actions: State['actions']) => void;
    /** Optional host text projection; source values stay unchanged. */
    project?: (
      action: ActionSnapshot,
    ) => Partial<Pick<ActionSnapshot, 'title' | 'description' | 'tooltip'>>;
  } = {},
) {
  const environment = options.environment ?? new NavigationHost();
  const store = createStore<State>(() => ({ actions: Object.create(null) }));
  const lifecycle = new ExecutionLifecycle();
  const owners = new Map<string, symbol>();
  const disposal = new Map<symbol, Set<() => void>>();
  function release(owner: symbol) {
    const cleanups = disposal.get(owner);
    disposal.delete(owner);
    const errors: unknown[] = [];
    for (const cleanup of [...(cleanups ?? [])].reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    cleanups?.clear();
    if (errors.length) throw new AggregateError(errors, 'Action cleanup failed.');
  }
  const placements = new Map<string, { count: number; original: boolean }>();
  let disposed = false;
  const bindings = new InstanceBindings(environment);
  let definitions: State['actions'] = Object.create(null);

  const source = (id: string) => (Object.hasOwn(definitions, id) ? definitions[id] : undefined);
  function publish(changed?: string) {
    const affected = changed
      ? affectedActions(definitions, changed)
      : new Set(Object.keys(definitions));
    const previous = store.getState().actions;
    const next: Record<string, ActionSnapshot> = Object.create(null);
    const cache = new Map<string, boolean>();
    const prerequisiteEnabled = (action: ActionSnapshot) => {
      // Unbound snapshots have no invocation input; contextual resolve() evaluates with input below.
      try {
        return action.enabled && (action.resolve?.(undefined)?.enabled ?? true);
      } catch {
        return false;
      }
    };
    // Unbound snapshots evaluate function-valued presentation without input; bound reads refine it.
    const unbound = (action: ActionSnapshot) => {
      try {
        return action.resolve?.(undefined) ?? {};
      } catch {
        return {};
      }
    };
    for (const action of Object.values(definitions)) {
      if (!affected.has(action.id) && previous[action.id]) {
        next[action.id] = previous[action.id];
        continue;
      }
      const presentation = unbound(action);
      const merged = {
        ...action,
        ...presentation,
        id: action.id,
        groups: action.groups,
        resolve: action.resolve,
        execute: action.execute,
      };
      next[action.id] = Object.freeze({
        ...merged,
        ...options.project?.(merged),
        enabled:
          action.enabled &&
          (presentation.enabled ?? true) &&
          (action.dependsOn ?? []).every((id) =>
            dependencyEnabled(id, definitions, prerequisiteEnabled, new Set([action.id]), cache),
          ),
        visible: action.visible && (presentation.visible ?? true),
      });
    }
    store.setState({ actions: next });
  }
  const running = new Map<string, Map<string, AbortController>>();
  function setPending(
    id: string,
    key: string,
    pending: boolean,
    status?: ActionStatus,
    error?: unknown,
  ) {
    const action = source(id);
    if (!action) return;
    const pendingKeys = pending
      ? [...new Set([...action.pendingKeys, key])]
      : action.pendingKeys.filter((item) => item !== key);
    definitions = {
      ...definitions,
      [id]: Object.freeze({
        ...action,
        pending: pendingKeys.length > 0,
        pendingKeys: Object.freeze(pendingKeys),
        status: status ?? action.status,
        error,
      }),
    };
    publish(id);
  }

  const get = (id: string) => {
    const { actions } = store.getState();
    return Object.hasOwn(actions, id) ? actions[id] : undefined;
  };

  function resolve(id: string, input?: unknown) {
    const action = source(id);
    if (!action) return undefined;
    const presentation = action.resolve?.(input);
    const resolved = {
      ...action,
      ...presentation,
      id: action.id,
      groups: action.groups,
      pending: action.pending,
      pendingKeys: action.pendingKeys,
      execute: action.execute,
      resolve: action.resolve,
      enabled: dependencyEnabled(
        id,
        definitions,
        (item) =>
          item.enabled &&
          (item.id === id
            ? (presentation?.enabled ?? true)
            : (item.resolve?.(input)?.enabled ?? true)),
      ),
      visible: action.visible && (presentation?.visible ?? true),
    };
    return Object.freeze({ ...resolved, ...options.project?.(resolved) });
  }

  function update(id: string, patch: ActionPatch): boolean {
    const current = source(id);
    if (!current || disposed) return false;
    // Preserve identity and runtime state even if untyped callers pass extra fields.
    const next = Object.freeze({
      ...current,
      ...patch,
      id,
      pending: current.pending,
      pendingKeys: current.pendingKeys,
      status: current.status,
      error: current.error,
      groups: freezeGroups(patch.groups ?? current.groups),
      dependsOn: freezeDependencies(
        Object.hasOwn(patch, 'dependsOn') ? patch.dependsOn : current.dependsOn,
      ),
      enabled: patch.enabled ?? current.enabled,
      visible: patch.visible ?? current.visible,
    });
    if (next.href !== undefined && !safeHref(next.href))
      throw new Error(`Action "${id}" has an invalid navigation target: ${String(next.href)}`);
    options.validate?.(next, store.getState().actions);
    bindings.apply(id, patch);
    definitions = { ...definitions, [id]: next };
    publish(id);
    return true;
  }

  function register(
    definition: ActionDefinition | Action<any, any>,
    placement: RegistrationOptions = {},
  ): ActionRegistration {
    if (definition instanceof Action || isBrandedInstance(definition, Action, 'action')) {
      if (!definition.id) throw new Error('Use add(id, action) for an action without an ID.');
      return add(definition.id, definition, placement);
    }
    if (disposed) throw new Error('Action list has been disposed.');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(definition.id)) {
      throw new Error(
        `Invalid action ID "${definition.id}". Use letters, numbers, dots, underscores, colons, slashes or hyphens.`,
      );
    }
    const { id } = definition;
    if (owners.has(id)) throw new Error(`Action "${id}" is already registered.`);
    const owner = Symbol(id);
    const action = Object.freeze({
      ...definition,
      ...placement,
      groups: freezeGroups(placement.groups ?? definition.groups),
      dependsOn: freezeDependencies(definition.dependsOn),
      enabled: definition.enabled ?? true,
      visible: definition.visible ?? true,
      pending: false,
      pendingKeys: Object.freeze([] as string[]),
      status: ActionStatus.Idle,
      state:
        definition.initialState === undefined
          ? undefined
          : Object.freeze(structuredClone(definition.initialState)),
      error: undefined,
    });
    if (action.href !== undefined && !safeHref(action.href))
      throw new Error(`Action "${id}" has an invalid navigation target: ${String(action.href)}`);
    options.validate?.(action, store.getState().actions);
    owners.set(id, owner);
    definitions = { ...definitions, [id]: action };
    publish(id);
    return {
      get: () => (owners.get(id) === owner && !disposed ? get(id) : undefined),
      onDispose(cleanup) {
        if (owners.get(id) !== owner || disposed) {
          cleanup();
          return;
        }
        let cleanups = disposal.get(owner);
        if (!cleanups) disposal.set(owner, (cleanups = new Set()));
        cleanups.add(cleanup);
      },
      update: (patch) => !disposed && owners.get(id) === owner && update(id, patch),
      unregister() {
        if (owners.get(id) !== owner) return;
        owners.delete(id);
        for (const key of placements.keys())
          if (key.startsWith(`${id}\u0000`)) placements.delete(key);
        const next = { ...definitions };
        delete next[id];
        definitions = next;
        for (const controller of running.get(id)?.values() ?? []) controller.abort();
        running.delete(id);
        try {
          release(owner);
        } finally {
          publish(id);
        }
      },
    };
  }

  function add<Input, Result>(
    id: string,
    action: Action<Input, Result>,
    placement: RegistrationOptions = {},
  ): ActionRegistration {
    const definition = {
      ...action.snapshot(),
      id,
      resolve: (input: unknown) => action.resolve(input as Input),
      // Class actions receive the same invocation context as plain handlers.
      execute: (context: ActionContext) =>
        action.execute(context.input as Input, context as ActionContext<Input>),
    };
    const registration = register(definition, placement);
    return {
      ...registration,
      unregister: bindings.attach(id, action, registration),
    };
  }

  const execute = createExecutor(
    setPending,
    owners,
    environment,
    get,
    resolve,
    update,
    lifecycle,
    running,
  );

  function dispose() {
    if (disposed) return;
    disposed = true;
    const errors: unknown[] = [];
    try {
      bindings.dispose();
    } catch (error) {
      errors.push(error);
    }
    for (const owner of [...disposal.keys()]) {
      try {
        release(owner);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const runs of running.values()) for (const controller of runs.values()) controller.abort();
    running.clear();
    lifecycle.clear();
    owners.clear();
    placements.clear();
    definitions = Object.create(null);
    store.setState({ actions: Object.create(null) });
    if (errors.length) throw new AggregateError(errors, 'Action list cleanup failed.');
  }

  for (const action of initialActions) register(action);
  let initialState: State | undefined;
  return {
    get,
    resolve,
    /** Re-evaluate host presentation after a locale or external context change. */
    refresh: () => {
      if (!disposed) publish();
    },
    use: (interceptor: import('./interceptors.js').ActionInterceptor) => lifecycle.use(interceptor),
    subscribeExecution: (listener: (event: import('./interceptors.js').ExecutionEvent) => void) =>
      lifecycle.subscribe(listener),
    add,
    register,
    /** Attach an existing action without duplicating it; cleanup owns only this placement. */
    attach(id: string, group: import('./groups.js').ActionGroup) {
      const action = get(id);
      const owner = owners.get(id);
      if (!action || !owner) throw new Error(`Unknown action "${id}".`);
      const key = `${id}\u0000${group.id}`;
      let entry = placements.get(key);
      if (!entry) {
        entry = {
          count: 0,
          original: action.groups?.some((item) => item.id === group.id) ?? false,
        };
        if (!entry.original) update(id, { groups: [...(action.groups ?? []), group] });
        placements.set(key, entry);
      }
      entry.count++;
      const owned = entry;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (owners.get(id) !== owner || placements.get(key) !== owned) return;
        if (--owned.count) return;
        placements.delete(key);
        if (!owned.original)
          update(id, {
            groups: get(id)?.groups?.filter((item) => item.id !== group.id),
          });
      };
    },
    update,
    /** Known IDs from ActionMap type their input and result; other IDs stay untyped. */
    execute: execute as <Id extends ActionId>(
      id: Id,
      input?: ActionInput<Id>,
    ) => Promise<ExecutionResult<ActionResult<Id>>>,
    dispose,
    mount: (navigate?: (href: string) => void) => bindings.mount(navigate),
    /** Read-only subscription surface; mutation stays in the methods above. */
    getState: store.getState,
    getInitialState: () => (initialState ??= store.getState()),
    subscribe: store.subscribe,
  };
}

export type ActionList = ReturnType<typeof createActionList>;
