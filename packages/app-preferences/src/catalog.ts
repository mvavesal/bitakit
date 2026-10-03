import {
  fallbackTitle,
  resolveText,
  type PluginMetadata,
  type SettingEntry,
  type SettingSpec,
  type SettingsDefinition,
  type Translator,
} from '@bitakit/core';
import type { SettingsCatalogField, SettingsCatalogSection } from '@bitakit/ui';
import type { ComponentType } from 'react';

/** What the catalog reads from a composed module; `runtime.modules` entries have this shape. */
export type SettingsCatalogModule = {
  readonly id: string;
  readonly metadata?: PluginMetadata;
  readonly settings?: SettingsDefinition<any>;
  readonly ui?: { readonly settings?: { readonly component: unknown } };
};
/** Resolves a translation key, or returns the fallback when the catalog has none. */
export type CatalogText = (key: string, fallback: string | undefined) => string | undefined;

// resolveText answers with the fallback for missing keys, so a sentinel detects them.
const missing = '\u0000';
export function catalogText(translate: Translator | undefined): CatalogText {
  return (key, fallback) => {
    if (!translate) return fallback;
    const value = resolveText(translate, key, missing);
    return value === missing ? fallback : value;
  };
}

/** One field with its translated label, description and option labels. */
export function catalogField(
  entry: SettingEntry,
  app: boolean,
  text: CatalogText,
): SettingsCatalogField {
  const { name, spec } = entry;
  const base = `${app ? 'app' : entry.plugin}.settings.${name}`;
  return {
    ...entry,
    label: text(`${base}.label`, spec.label) ?? fallbackTitle({ id: name }),
    description: text(`${base}.description`, spec.description),
    options: spec.options?.map((option) => ({
      value: option.value,
      label:
        text(`${base}.options.${String(option.value)}.label`, option.label) ??
        fallbackTitle({ id: String(option.value) }),
      description: text(`${base}.options.${String(option.value)}.description`, option.description),
      icon: option.icon,
    })),
  };
}

const byOrder = <T extends { order?: number }>(a: T, b: T) =>
  (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY);

/**
 * Every module that declares settings or a settings page, as settings sections. The same rules
 * as `useSettingsCatalog()` from `@bitakit/ui`, for code without React such as plugin setup:
 * labels resolve `<plugin>.settings.<name>.label` (the app uses `app`), then the declaration,
 * then the name.
 */
export function settingsCatalog(
  modules: readonly SettingsCatalogModule[],
  appId: string,
  translate?: Translator,
): readonly SettingsCatalogSection[] {
  const text = catalogText(translate);
  const sections: SettingsCatalogSection[] = [];
  for (const module of modules) {
    const app = module.id === appId;
    const prefix = app ? 'app' : module.id;
    const definition = module.settings;
    const page = module.ui?.settings?.component as ComponentType | undefined;
    const specs = Object.entries((definition?.settings ?? {}) as Record<string, SettingSpec<any>>);
    if (!specs.length && !page) continue;
    const fields = specs
      .filter(([, spec]) => !spec.hidden)
      .map(([name, spec]) =>
        catalogField(
          { key: app ? name : `${module.id}.${name}`, plugin: module.id, name, spec },
          app,
          text,
        ),
      )
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
}

/** Sections a settings UI shows: those with visible fields or their own page. */
export function visibleSections(
  sections: readonly SettingsCatalogSection[],
): readonly SettingsCatalogSection[] {
  return sections.filter((section) => section.component || section.fields.length);
}
