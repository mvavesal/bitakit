'use client';
import { createElement, memo, useCallback, useSyncExternalStore, type ComponentType } from 'react';
import { useBitaKit } from '../providers/foundation-context.js';
import { useSlot } from '../hooks/use-slot.js';
import type { SlotName, SlotMap } from '@bitakit/core';
import type { SlotOptions } from '../hooks/use-slot.js';
import { subscribeReadiness } from '../utils/subscribe-readiness.js';
import { SlotErrorBoundary, type SlotErrorFallback } from './slot-error-boundary.js';
const notReady = () => false;
/** Initial readiness, optionally narrowed to an owner during compatible plugin updates. */
export function useBitaKitReady(plugin?: string) {
  const { runtime } = useBitaKit();
  const read = useCallback(() => runtime.isReady(plugin), [runtime, plugin]);
  const subscribe = useCallback(
    (listener: () => void) => subscribeReadiness(runtime, listener),
    [runtime],
  );
  return useSyncExternalStore(subscribe, read, notReady);
}
/**
 * One placed component. Memoized on its component and payload: when the outlet renders again
 * with the same payload, the contribution does not (it still follows its own hooks).
 */
const Contribution = memo(function Contribution({
  component,
  payload,
}: {
  component: ComponentType<any>;
  payload: unknown;
}) {
  return createElement(component, { payload });
});

/** Renders every component plugins placed in the slot; layouts use `useSlot` for custom markup. */
export function PluginSlot<const Name extends SlotName>(
  props: { name: Name; errorFallback?: SlotErrorFallback } & SlotOptions<Name> &
    (Name extends keyof SlotMap
      ? SlotMap[Name] extends { accepts: 'component' }
        ? unknown
        : never
      : unknown),
) {
  const view = useSlot(props.name as string, { payload: props.payload, entryKey: props.entryKey });
  if (view.error) throw view.error;
  return view.items.flatMap((entry) =>
    entry.kind === 'component'
      ? [
          <SlotErrorBoundary
            key={entry.key}
            slot={props.name}
            plugin={entry.plugin}
            contribution={entry.key}
            errorFallback={props.errorFallback}
          >
            <Contribution component={entry.component} payload={view.payload} />
          </SlotErrorBoundary>,
        ]
      : [],
  );
}
