'use client';
import { settingsText } from './ui-context.js';
import { resolveLocalized } from '../text.js';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AppPreferences } from '../app-preferences.js';
import type { SettingsContext } from '../types.js';
import type { SettingsSection } from '../catalog/section.js';
import { SettingsUIContext } from './context.js';
const Context = createContext<{
  settings: AppPreferences;
  serverSections: readonly SettingsSection[];
} | null>(null);
/** Activates the supplied settings instance for the current identity and releases it on cleanup. */
export function SettingsProvider({
  settings,
  context = {},
  children,
}: {
  settings: AppPreferences;
  context?: SettingsContext;
  children: ReactNode;
}) {
  const { userId, organizationId } = context;
  // Suspense children may hydrate after plugin effects have changed the live catalog.
  // Match the initial server render, then useSyncExternalStore adopts the live snapshot.
  const value = useMemo(() => ({ settings, serverSections: settings.getSections() }), [settings]);
  useLayoutEffect(() => {
    void settings.activate({ userId, organizationId });
    return () => settings.deactivate();
  }, [settings, userId, organizationId]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
/** Returns the existing settings instance from the nearest SettingsProvider. */
export function useSettings() {
  const value = useContext(Context);
  if (!value) throw new Error('SettingsProvider is required.');
  return value.settings;
}
/** Lets the Foundation integration reuse a host-owned provider and identity context. */
export function useOptionalSettings() {
  return useContext(Context)?.settings;
}
/**
 * Subscribes to catalog changes while preserving the initial server snapshot during hydration.
 * Before a Foundation runtime mounts, statically contributed sections are included so server,
 * hydration and post-mount renders list the same sections.
 */
export function useSettingsSections() {
  const value = useContext(Context);
  if (!value) throw new Error('SettingsProvider is required.');
  const live = useSyncExternalStore(
    value.settings.subscribeSections,
    value.settings.getSections,
    () => value.serverSections,
  );
  const ui = useContext(SettingsUIContext);
  const pending = ui?.initial?.sections;
  return useMemo(() => {
    const ids = new Set(live.map((section) => section.id));
    const sections = [...live, ...(pending ?? []).filter((section) => !ids.has(section.id))];
    const text = settingsText(ui?.translate);
    return sections.map(
      (section) =>
        Object.assign(Object.create(Object.getPrototypeOf(section)), section, {
          title: text.sectionTitle(section),
          description: text.sectionDescription(section),
          category: section.category
            ? {
                ...section.category,
                title: resolveLocalized(
                  ui?.translate,
                  [`settings.categories.${section.category.id}.title`],
                  section.category.title,
                ),
              }
            : undefined,
        }) as typeof section,
    );
  }, [live, pending, ui?.translate]);
}
