import type { FoundationRuntime } from '@bitakit/core';

/** Observe initial readiness and owner transitions without keeping a second status store. */
export function subscribeReadiness(runtime: FoundationRuntime, listener: () => void) {
  const offReady = runtime.subscribeReady(listener);
  const offOwner = runtime.lifecycle.subscribe(listener);
  return () => {
    offReady();
    offOwner();
  };
}
