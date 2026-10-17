'use client';
import { useMemo, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { SettingEntry } from '@bitakit/core';
import { settingsCatalog } from '../settings/catalog.js';
import { useBitaKit } from '../providers/foundation-context.js';
import { useTranslation } from './use-translation.js';

export type SettingsCatalogOption = {
  value: unknown;
  label: string;
  description?: string;
  icon?: unknown;
};
export type SettingsCatalogField = SettingEntry & {
  label: string;
  description?: string;
  options?: readonly SettingsCatalogOption[];
};
export type SettingsCatalogSection = {
  /** The owning module: a plugin ID, or `app`. */
  id: string;
  /** Owner is stable even when a plugin contributes multiple pages. */
  plugin: string;
  shortcut?: string;
  showHeader?: boolean;
  /** URL segment under the settings base path: the plugin ID, `general` for the app. */
  path: string;
  app: boolean;
  title: string;
  description?: string;
  icon?: unknown;
  /** `general` for the app, `plugins` for plugins that declare none. */
  category: string;
  order: number;
  /** Declared, non-hidden settings in declaration order, then by `order`. */
  fields: readonly SettingsCatalogField[];
  /** `ui/settings/page.tsx` of the module, when present; it replaces the generated page. */
  component?: ComponentType;
  /** Encloses content and extensions; the owning plugin retains access policy. */
  boundary?: ComponentType<{ children: ReactNode }>;
};

export function useSettingsCatalog(): readonly SettingsCatalogSection[] {
  const { runtime } = useBitaKit();
  const t = useTranslation();
  const state = useSyncExternalStore(
    runtime.lifecycle.subscribe,
    runtime.lifecycle.get,
    runtime.lifecycle.get,
  );
  return useMemo(
    () =>
      settingsCatalog(runtime.modules, runtime.config.appId ?? 'app', (key) =>
        t(key, undefined, key),
      ),
    [runtime, t, state],
  );
}
