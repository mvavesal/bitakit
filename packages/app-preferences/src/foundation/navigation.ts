import {
  ActionGroup,
  destinationMetadata,
  type PluginScope,
  type TranslationService,
} from '@bitakit/core';
import { resolveLocalized } from '../text.js';
import type { AppPreferences } from '../app-preferences.js';

/** Project the authoritative catalog into the existing ActionList; retain registration ownership. */
export function bindSettingsNavigation(
  scope: PluginScope,
  settings: AppPreferences,
  i18n?: TranslationService,
) {
  const target = scope.actions.getGroup('settings.pages');
  const actionIds = new Map<string, string>();
  const registrations = new Map<string, ReturnType<typeof target.add>>();
  const sync = () => {
    const sections = settings.getSections();
    const ids = new Set(sections.map((section) => section.id));
    for (const [id, handle] of registrations) {
      if (!ids.has(id)) {
        handle.dispose();
        registrations.delete(id);
        actionIds.delete(id);
      }
    }
    for (const section of sections) {
      const definition = {
        id: section.navigation?.id ?? `settings.section.${section.id}`,
        shortcut: section.navigation?.shortcut ? { keys: section.navigation.shortcut } : undefined,
        title: resolveLocalized(
          i18n?.translate,
          [section.titleKey, `settings.sections.${section.id}.title`],
          section.title,
        ),
        description:
          resolveLocalized(
            i18n?.translate,
            [section.descriptionKey, `settings.sections.${section.id}.description`],
            section.description ?? '',
          ) || undefined,
        href: `/settings/${section.path}`,
        icon: section.icon,
        visible: section.visible,
        enabled: section.enabled,
        order: section.order,
        // Search names the owning plugin; the catalog already validated it.
        metadata: destinationMetadata({ kind: 'settings', plugin: section.pluginId }),
        groups: [
          ...(section.category
            ? [
                new ActionGroup(
                  `settings.category.${section.category.id}`,
                  resolveLocalized(
                    i18n?.translate,
                    [`settings.categories.${section.category.id}.title`],
                    section.category.title,
                  ),
                ),
              ]
            : []),
          ...(section.navigation?.groups ?? []).map((id) => new ActionGroup(id)),
        ],
      };
      if (actionIds.has(section.id) && actionIds.get(section.id) !== definition.id) {
        registrations.get(section.id)?.dispose();
        registrations.delete(section.id);
      }
      actionIds.set(section.id, definition.id);
      const existing = registrations.get(section.id);
      if (existing) existing.update(definition);
      else registrations.set(section.id, target.add(definition));
    }
  };
  sync();
  const unsubscribe = settings.subscribeSections(sync);
  const stopTranslation = i18n?.subscribe(sync);
  return () => {
    unsubscribe();
    stopTranslation?.();
    for (const handle of registrations.values()) handle.dispose();
    registrations.clear();
    actionIds.clear();
  };
}
