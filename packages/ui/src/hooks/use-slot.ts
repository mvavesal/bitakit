'use client';
import { useMemo, type ComponentType } from 'react';
import { useFoundation } from '../providers/foundation-context.js';
import { useFoundationReady } from '../components/plugin-slot.js';

export type SlotEntry = {
  key: string;
  plugin: string;
  component: ComponentType;
  order?: number;
};
/** The components plugins placed in a slot, in order; empty until the runtime is ready. */
export function useSlot(name: string): readonly SlotEntry[] {
  const { runtime } = useFoundation();
  const ready = useFoundationReady();
  return useMemo(
    () =>
      ready
        ? runtime.modules
            .flatMap((plugin) =>
              (plugin.views ?? []).map((view, index) => ({
                key: `${plugin.id}:${index}`,
                plugin: plugin.id,
                component: view.component as ComponentType,
                order: view.order,
                slot: view.slot,
              })),
            )
            .filter((view) => view.slot === name)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map(({ slot: _slot, ...entry }) => entry)
        : [],
    [runtime, ready, name],
  );
}
