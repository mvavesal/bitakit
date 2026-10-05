'use client';
import { createElement, useCallback, useSyncExternalStore } from 'react';
import { useFoundation } from '../providers/foundation-context.js';
import { useSlot } from '../hooks/use-slot.js';
import type { SlotName, SlotMap } from '@bitakit/core';
import type { SlotOptions } from '../hooks/use-slot.js';
import { subscribeReadiness } from '../utils/subscribe-readiness.js';
import { SlotErrorBoundary, type SlotErrorFallback } from './slot-error-boundary.js';
const notReady = () => false;
/** Initial readiness, optionally narrowed to an owner during compatible plugin updates. */
export function useFoundationReady(plugin?: string) {
  const { runtime } = useFoundation();
  const read = useCallback(() => runtime.isReady(plugin), [runtime, plugin]);
  const subscribe = useCallback(
    (listener: () => void) => subscribeReadiness(runtime, listener),
    [runtime],
  );
  return useSyncExternalStore(subscribe, read, notReady);
}
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
            {createElement(entry.component, { payload: view.payload })}
          </SlotErrorBoundary>,
        ]
      : [],
  );
}
