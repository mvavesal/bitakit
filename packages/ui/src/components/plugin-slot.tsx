'use client';
import {
  createElement,
  memo,
  useCallback,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
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
 * One placed component. Memoized on its component, payload and children: when the outlet
 * renders again with the same values, the contribution does not (it still follows its own hooks).
 */
const Contribution = memo(function Contribution({
  component,
  payload,
  children,
}: {
  component: ComponentType<any>;
  payload: unknown;
  children?: ReactNode;
}) {
  return createElement(component, { payload, children });
});

/**
 * Renders the components plugins placed in the slot; custom markup uses `useSlot`. `children` go
 * to each contribution (a layout wraps the page); `fallback` renders when nothing is placed, and
 * replaces a failing occupant of a `single` slot, so a broken replacement shows the default.
 */
export function PluginSlot<const Name extends SlotName>(
  props: {
    name: Name;
    errorFallback?: SlotErrorFallback;
    fallback?: ReactNode;
    children?: ReactNode;
  } & SlotOptions<Name> &
    (Name extends keyof SlotMap
      ? SlotMap[Name] extends { accepts: 'component' }
        ? unknown
        : never
      : unknown),
) {
  const view = useSlot(props.name as string, { payload: props.payload, entryKey: props.entryKey });
  if (view.error) throw view.error;
  const fallback = props.fallback;
  const errorFallback =
    props.errorFallback ??
    (view.policy === 'single' && fallback !== undefined ? () => fallback : undefined);
  const rendered = view.items.flatMap((entry) =>
    entry.kind === 'component'
      ? [
          <SlotErrorBoundary
            key={entry.key}
            slot={props.name}
            plugin={entry.plugin}
            contribution={entry.key}
            errorFallback={errorFallback}
          >
            <Contribution component={entry.component} payload={view.payload}>
              {props.children}
            </Contribution>
          </SlotErrorBoundary>,
        ]
      : [],
  );
  return rendered.length || fallback === undefined ? rendered : fallback;
}
