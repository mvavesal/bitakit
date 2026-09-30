'use client';
import { createElement, useSyncExternalStore } from 'react';
import { useFoundation } from '../providers/foundation-context.js';
const notReady = () => false;
/** Runtime contributions are mounted before dependent settings pages and views render. */
export function useFoundationReady() {
  const { runtime } = useFoundation();
  return useSyncExternalStore(runtime.subscribeReady, runtime.isReady, notReady);
}
export function PluginSlot({ name }: { name: string }) {
  const { runtime } = useFoundation();
  const ready = useFoundationReady();
  if (!ready) return null;
  return (runtime.modules)
    .flatMap((plugin) =>
      (plugin.views ?? []).map((view, index) => ({ ...view, key: `${plugin.id}:${index}` })),
    )
    .filter((view) => view.slot === name)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((view) => createElement(view.component, { key: view.key }));
}
