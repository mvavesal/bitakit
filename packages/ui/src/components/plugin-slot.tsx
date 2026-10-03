'use client';
import { createElement, useSyncExternalStore } from 'react';
import { useFoundation } from '../providers/foundation-context.js';
import { useSlot } from '../hooks/use-slot.js';
const notReady = () => false;
/** Runtime contributions are mounted before dependent settings pages and views render. */
export function useFoundationReady() {
  const { runtime } = useFoundation();
  return useSyncExternalStore(runtime.subscribeReady, runtime.isReady, notReady);
}
/** Renders every component plugins placed in the slot; layouts use `useSlot` for custom markup. */
export function PluginSlot({ name }: { name: string }) {
  const entries = useSlot(name);
  return entries.map((entry) => createElement(entry.component, { key: entry.key }));
}
