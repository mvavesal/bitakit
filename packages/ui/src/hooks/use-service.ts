'use client';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { isStore, type GeneratedName, type ServiceMap, type Store } from '@bitakit/core';
import { useBitaKit } from '../providers/foundation-context.js';
import { shallowEqual } from '../utils/merge-props.js';
import { subscribeReadiness } from '../utils/subscribe-readiness.js';

/** A service ID or contract name; strict generated apps reject unknown names. */
type ServiceName = GeneratedName<Extract<keyof ServiceMap, string>>;
type ServiceOf<Name extends string> = Name extends keyof ServiceMap
  ? NonNullable<ServiceMap[Name]>
  : unknown;
type StateOf<S> = S extends { state: Store<infer T> }
  ? T
  : S extends { getSnapshot(): infer T }
    ? T
    : unknown;

const idle = () => () => {};

/** The ready service instance; follows replacement. Use useServiceState for its data. */
export function useService<Name extends ServiceName>(name: Name): ServiceOf<Name> | undefined {
  const { runtime } = useBitaKit();
  const read = useCallback(
    () => (runtime.isServiceReady(name) ? readService(runtime.services, name) : undefined),
    [runtime, name],
  );
  const subscribe = useCallback(
    (listener: () => void) => subscribeReadiness(runtime, listener),
    [runtime],
  );
  return useSyncExternalStore(subscribe, read, () => undefined) as ServiceOf<Name> | undefined;
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
      subscribe: (listener) =>
        (candidate.subscribe as (listener: () => void) => () => void).call(candidate, listener),
      get: () => (candidate.getSnapshot as () => unknown)(),
    };
  return undefined;
}

/**
 * Reactive state of a service: its `store()` (exposed as `state`) or a `subscribe`/`getSnapshot`
 * pair. Re-renders when the selected value changes. Returns `fallback` until the runtime
 * and its owning plugin are ready. Unrelated updates keep the current source subscribed.
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
  const { runtime } = useBitaKit();
  const last = useRef<{ value: unknown; has: boolean }>({ value: undefined, has: false });
  const select = selector ?? ((state: unknown) => state);
  const subscribe = useCallback(
    (listener: () => void) => {
      let stopSource = idle();
      let current: unknown;
      const attach = () => {
        const service = runtime.isServiceReady(name)
          ? readService(runtime.services, name)
          : undefined;
        if (service === current) return;
        stopSource();
        current = service;
        const source = sourceOf(service);
        stopSource = source ? source.subscribe(listener) : idle();
      };
      const stopReady = subscribeReadiness(runtime, () => {
        attach();
        listener();
      });
      attach();
      return () => {
        stopReady();
        stopSource();
      };
    },
    [runtime, name],
  );
  const getSnapshot = () => {
    if (!runtime.isServiceReady(name)) return fallback;
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
