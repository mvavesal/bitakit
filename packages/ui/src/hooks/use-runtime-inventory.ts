'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { observeRuntimeInventory } from '@bitakit/core';
import { useBitaKit } from '../providers/foundation-context.js';

/** Shared read-only diagnostics; execution and service subscriptions retain their existing APIs. */
export function useRuntimeInventory() {
  const { runtime } = useBitaKit();
  const source = useMemo(() => observeRuntimeInventory(runtime), [runtime]);
  return useSyncExternalStore(source.subscribe, source.get, source.get);
}
