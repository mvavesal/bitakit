'use client';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { EventSelector, EventHandler } from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';

/** React-owned subscription to the runtime's bus; released with the component. */
export function useEvent<const Name extends EventSelector>(
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
    return runtime.events.on(selected, (event, context) =>
      current.current(event as never, context),
    );
  }, [runtime, ready, key]);
}