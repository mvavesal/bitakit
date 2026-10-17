'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { observeRuntimeInventory } from '@bitakit/core';
import { useBitaKit } from '../providers/foundation-context.js';

/**
 * Shared read-only diagnostics; execution and service subscriptions retain their existing APIs.
 * `live` is `null` during server rendering and hydration: the server never starts the runtime,
 * and a lazily hydrated route may hydrate after the client started it, so both read the static
 * inventory only. The live state follows right after hydration.
 */
export function useRuntimeInventory() {
  const { runtime } = useBitaKit();
  const source = useMemo(() => observeRuntimeInventory(runtime), [runtime]);
  const initial = useMemo(() => {
    const snapshot = Object.freeze({ ...source.get(), live: null });
    return () => snapshot;
  }, [source]);
  return useSyncExternalStore(source.subscribe, source.get, initial);
}
