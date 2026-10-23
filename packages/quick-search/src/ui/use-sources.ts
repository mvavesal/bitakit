'use client';
import { useCallback, useMemo } from 'react';
import { useSlot, useTranslation } from '@bitakit/ui';
import type { RegisteredSource, SearchText } from '../types.js';
import '../slots.js';

export function useSources(): readonly RegisteredSource[] {
  const slot = useSlot('quick-search.sources');
  return useMemo(
    () => slot.items.map((item) => ({ id: item.key, plugin: item.plugin, source: item.data })),
    [slot.items],
  );
}
export function useSearchText() {
  const t = useTranslation();
  return useCallback(
    (value: SearchText) =>
      typeof value === 'string'
        ? t(value, undefined, value)
        : t(value.key, undefined, value.fallback),
    [t],
  );
}
