'use client';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { isStore, type ServiceMap, type Store } from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';
import { shallowEqual } from '../utils/merge-props.js';

type ServiceName = Extract<keyof ServiceMap, string> | (string & {});
type ServiceOf<Name extends string> = Name extends keyof ServiceMap
  ? NonNullable<ServiceMap[Name]>
  : unknown;
type StateOf<S> = S extends { state: Store<infer T> }
  ? T
  : S extends { getSnapshot(): infer T }
    ? T
    : unknown;

const idle = () => () => {};

/** The service instance, or undefined until the runtime is ready. Not reactive; use useServiceState for data. */
export function useService<Name extends ServiceName>(name: Name): ServiceOf<Name> | undefined {
  const { runtime } = useFoundation();
  const ready = useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
  if (!ready || !runtime.hasService(name)) return undefined;
  return readService(runtime.services, name) as ServiceOf<Name>;
}

function readService(tree: unknown, name: string): unknown {
  let current = tree;
  for (const segment of name.split('.')) current = (current as Record<string, unknown>)[segment];
  return current;
}
function sourceOf(
  service: unknown,
): { subscribe(listener: () => void): () => void; get(): unknown } | undefined {
  const candidate = service as
    | { state?: unknown; subscribe?: unknown; getSnapshot?: unknown }
    | undefined;
  if (candidate && isStore(candidate.state)) return candidate.state as Store<unknown>;
  if (
    candidate &&
    typeof candidate.subscribe === 'function' &&
    typeof candidate.getSnapshot === 'function'
  )
    return {
      subscribe: candidate.subscribe as never,
      get: () => (candidate.getSnapshot as () => unknown)(),
    };
  return undefined;
}

/**
 * Reactive state of a service: its `store()` (exposed as `state`) or a `subscribe`/`getSnapshot`
 * pair. Re-renders when the selected value changes. Returns `fallback` until the runtime is
 * ready.
 */
export function useServiceState<Name extends ServiceName, R = StateOf<ServiceOf<Name>>>(
  name: Name,
  selector?: (state: StateOf<ServiceOf<Name>>) => R,
): R | undefined;
export function useServiceState<Name extends ServiceName, R = StateOf<ServiceOf<Name>>>(
  name: Name,
  selector: ((state: StateOf<ServiceOf<Name>>) => R) | undefined,
  fallback: R,
): R;
export function useServiceState(
  name: string,
  selector?: (state: any) => unknown,
  fallback?: unknown,
): unknown {
  const { runtime } = useFoundation();
  const last = useRef<{ value: unknown; has: boolean }>({ value: undefined, has: false });
  const select = selector ?? ((state: unknown) => state);
  const subscribe = useCallback(
    (listener: () => void) => {
      const stopReady = runtime.subscribeReady(listener);
      let stopSource = idle();
      const attach = () => {
        stopSource();
        const service =
          runtime.isReady() && runtime.hasService(name)
            ? readService(runtime.services, name)
            : undefined;
        const source = sourceOf(service);
        stopSource = source ? source.subscribe(listener) : idle();
      };
      attach();
      const stopReattach = runtime.subscribeReady(attach);
      return () => {
        stopReady();
        stopReattach();
        stopSource();
      };
    },
    [runtime, name],
  );
  const getSnapshot = () => {
    if (!runtime.isReady() || !runtime.hasService(name)) return fallback;
    const service = readService(runtime.services, name);
    const source = sourceOf(service);
    if (!source)
      throw new Error(
        `useServiceState("${name}"): the service has no observable state. Expose a store as "state" (defineService(({ store }) => ({ state: store(...) })) or provide subscribe()/getSnapshot().`,
      );
    const next = select(source.get());
    if (last.current.has && shallowEqual(last.current.value, next)) return last.current.value;
    last.current = { value: next, has: true };
    return next;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
