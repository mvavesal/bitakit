'use client';
import { useSyncExternalStore } from 'react';
import type { FoundationApp, Plugin, PublicServiceMap, PublicServicesOf } from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';

/** Reads the existing app facade and follows mount/removal. Service data uses its own subscription hooks. */
export function useFoundationApp<Plugins extends readonly Plugin[] | undefined = undefined>() {
  const { runtime } = useFoundation();
  useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
  useSyncExternalStore(runtime.lifecycle.subscribe, runtime.lifecycle.get, runtime.lifecycle.get);
  return runtime.app as unknown as FoundationApp<
    Plugins extends readonly Plugin[] ? PublicServicesOf<Plugins> : PublicServiceMap
  >;
}
