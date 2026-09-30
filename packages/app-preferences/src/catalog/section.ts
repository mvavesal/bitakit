import type { ComponentType } from 'react';
import type { Setting } from '../fields/setting.js';
import { settingsOf, type SettingsSource } from '../fields/builders.js';
import type { LocalizedText } from '../types.js';
import { localizedFallback, localizedKey } from '../text.js';
/** Groups related definitions for presentation without changing their storage scope. */
export class SettingsGroup {
  readonly title: string;
  readonly items: readonly Setting<any>[];
  constructor(options: { title: string; items: readonly Setting<any>[] }) {
    this.title = options.title;
    this.items = options.items;
  }
}
export type SectionOptions = {
  /** Optional Foundation navigation metadata; the catalog owns the destination and presentation. */
  navigation?: { id?: string; groups?: readonly string[]; shortcut?: string };
  /** The owning module. Contributed sections receive it from their contributing module. */
  pluginId?: string;
  id: string;
  scope?: { id: string; title: string; home: string };
  path?: string;
  showHeader?: boolean;
  title: LocalizedText;
  titleKey?: string;
  description?: LocalizedText;
  descriptionKey?: string;
  /** Collections or definitions shown in this section. Registration stays with their owners. */
  settings?: readonly SettingsSource[];
  /** Navigation order within a category; unordered sections follow ordered ones. */
  order?: number;
  /** Legacy grouped definitions; these are registered for the section's lifetime. */
  groups?: readonly SettingsGroup[];
  component?: ComponentType;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  category?: { id: string; path?: string; title: string; description?: string; order?: number };
  enabled?: boolean;
  visible?: boolean;
};
const byOrder = (a: Setting<any>, b: Setting<any>) =>
  (a.presentation.order ?? Number.POSITIVE_INFINITY) -
  (b.presentation.order ?? Number.POSITIVE_INFINITY);
/** Describes a catalog page with referenced settings, legacy groups or a host component; it does not persist values. */
export class SettingsSection {
  readonly navigation?: SectionOptions['navigation'];
  readonly pluginId?: string;
  readonly id: string;
  readonly scope?: SectionOptions['scope'];
  readonly path: string;
  readonly showHeader: boolean;
  readonly title: string;
  readonly titleKey?: string;
  readonly description?: string;
  readonly descriptionKey?: string;
  readonly settings: readonly SettingsSource[];
  /** Referenced definitions sorted by order, then collection order, then declaration order. */
  readonly fields: readonly Setting<any>[];
  readonly order?: number;
  readonly groups: readonly SettingsGroup[];
  readonly component?: ComponentType;
  readonly icon?: SectionOptions['icon'];
  readonly category?: SectionOptions['category'];
  readonly enabled: boolean;
  readonly visible: boolean;
  constructor(options: SectionOptions) {
    if (!/^[a-z][a-z0-9-]*$/.test(options.id)) throw new Error('Invalid settings section ID.');
    this.id = options.id;
    this.navigation = options.navigation;
    this.pluginId = options.pluginId;
    this.scope = options.scope;
    this.path = options.path ?? options.id;
    this.showHeader = options.showHeader ?? true;
    if (!/^[a-z][a-z0-9-]*$/.test(this.path)) throw new Error('Invalid section path.');
    this.title = localizedFallback(options.title) ?? '';
    this.titleKey = options.titleKey ?? localizedKey(options.title);
    this.description = localizedFallback(options.description);
    this.descriptionKey = options.descriptionKey ?? localizedKey(options.description);
    this.settings = Object.freeze([...(options.settings ?? [])]);
    const fields = settingsOf(this.settings);
    const keys = new Map<string, Setting<any>>();
    for (const field of fields) {
      if (keys.has(field.key) && keys.get(field.key) !== field)
        throw new Error(`Duplicate setting "${field.key}" in settings section "${this.id}".`);
      keys.set(field.key, field);
    }
    this.fields = Object.freeze([...new Set(fields)].sort(byOrder));
    this.order = options.order;
    this.groups = options.groups ?? [];
    this.component = options.component;
    this.icon = options.icon;
    this.category = options.category;
    this.enabled = options.enabled ?? true;
    this.visible = options.visible ?? true;
  }
}
/** Declares a section that references collections; fields appear without a repeated content list. */
export function defineSettingsSection(options: SectionOptions) {
  return new SettingsSection(options);
}
