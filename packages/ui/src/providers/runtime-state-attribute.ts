/** `<html data-bitakit-runtime>`: the provider's startup state, read by `bitakit check-page`. */
export const runtimeStateAttribute = 'data-bitakit-runtime';
export type RuntimeState = 'starting' | 'ready' | 'failed';

/**
 * Publishes one provider mount's startup state on the document element so tools without React
 * access can wait for startup: `starting`, then `ready` once initial startup completed (isolated
 * plugin failures included) or `failed` when it cannot complete. Only effects call it, so server
 * and hydration markup never carry the attribute.
 */
export function runtimeStateMarker() {
  const root = document.documentElement;
  let current: RuntimeState | undefined;
  return {
    set(state: RuntimeState) {
      current = state;
      root.setAttribute(runtimeStateAttribute, state);
    },
    /** Keeps `failed`: a fail-fast startup error tears the provider down right after it. */
    release() {
      if (current !== 'failed') root.removeAttribute(runtimeStateAttribute);
    },
  };
}
