'use client';
import { useMemo, type ComponentType } from 'react';
import { fallbackTitle, type SettingEntry, type SettingSpec } from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';
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
};

const missing = '\u0000';
const byOrder = <T extends { order?: number }>(a: T, b: T) =>
  (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY);
/**
 * Every module that declares settings or a settings page, as sections for a settings UI.
 * Labels resolve through the translator: `<plugin>.settings.<name>.label` (the app uses `app`),
 * then the declaration, then the name.
 */
export function useSettingsCatalog(): readonly SettingsCatalogSection[] {
  const { runtime } = useFoundation();
  const t = useTranslation();
  return useMemo(() => {
    const appId = runtime.config.appId ?? 'app';
    const sections: SettingsCatalogSection[] = [];
    for (const module of runtime.modules) {
      const app = module.id === appId;
      const prefix = app ? 'app' : module.id;
      const definition = module.settings;
      const page = module.ui?.settings?.component as ComponentType | undefined;
      const specs = Object.entries(
        (definition?.settings ?? {}) as Record<string, SettingSpec<any>>,
      );
      if (!specs.length && !page) continue;
      // The default translator answers every key, so a sentinel fallback detects missing keys.
      const text = (key: string, fallback: string | undefined) => {
        const value = t(key, undefined, missing);
        return value === missing ? fallback : value;
      };
      const fields = specs
        .filter(([, spec]) => !spec.hidden)
        .map(([name, spec]): SettingsCatalogField => {
          const base = `${prefix}.settings.${name}`;
          return {
            key: app ? name : `${module.id}.${name}`,
            plugin: module.id,
            name,
            spec,
            label: text(`${base}.label`, spec.label) ?? fallbackTitle({ id: name }),
            description: text(`${base}.description`, spec.description),
            options: spec.options?.map((option) => ({
              value: option.value,
              label:
                text(`${base}.options.${String(option.value)}.label`, option.label) ??
                fallbackTitle({ id: String(option.value) }),
              description: text(
                `${base}.options.${String(option.value)}.description`,
                option.description,
              ),
              icon: option.icon,
            })),
          };
        })
        .sort((a, b) => byOrder(a.spec, b.spec));
      const section = definition?.section;
      sections.push({
        id: module.id,
        path: section?.path ?? (app ? 'general' : module.id),
        app,
        title:
          text(`${prefix}.settings.title`, section?.title ?? module.metadata?.name) ??
          (app ? 'General' : fallbackTitle({ id: module.id })),
        description: text(`${prefix}.settings.description`, section?.description),
        icon: section?.icon ?? module.metadata?.icon,
        category: section?.category ?? (app ? 'general' : 'plugins'),
        order: section?.order ?? (app ? -10 : 0),
        fields,
        component: page,
      });
    }
    return sections.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [runtime, t]);
}
