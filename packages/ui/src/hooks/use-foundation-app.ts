'use client';
import { useSyncExternalStore } from 'react';
import type { BitaKitApp, Plugin, PublicServicesOf, ServiceMap } from '@bitakit/core';
import { useBitaKit } from '../providers/foundation-context.js';

/** Reads the existing app facade and follows mount/removal. Service data uses its own subscription hooks. */
export function useBitaKitApp<Plugins extends readonly Plugin[] | undefined = undefined>() {
  const { runtime } = useBitaKit();
  useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
  useSyncExternalStore(runtime.lifecycle.subscribe, runtime.lifecycle.get, runtime.lifecycle.get);
  return runtime.app as unknown as BitaKitApp<
    Plugins extends readonly Plugin[] ? PublicServicesOf<Plugins> : ServiceMap
  >;
}
