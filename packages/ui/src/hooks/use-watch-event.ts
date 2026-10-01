'use client';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { EventName, EventHandler } from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';

/** React-owned subscription to the runtime's existing bus; no separate event state. */
export function useWatchEvent<const Name extends EventName>(
  names: Name | readonly Name[],
  handler: EventHandler<Name>,
) {
  const { runtime } = useFoundation();
  const ready = useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
  const current = useRef(handler);
  useLayoutEffect(() => {
    current.current = handler;
  }, [handler]);
  // Inline arrays with the same names must not create fresh subscriptions on every render.
  const key = JSON.stringify([...new Set(typeof names === 'string' ? [names] : names)]);
  useEffect(() => {
    if (!ready) return;
    const selected = JSON.parse(key) as Name[];
    return runtime.events.watch(selected, (event, context) => current.current(event, context));
  }, [runtime, ready, key]);
}
