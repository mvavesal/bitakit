import {
  ActionGroup,
  destinationMetadata,
  resolveText,
  scopePlugins,
  type PluginScope,
  type TranslationService,
} from '@bitakit/core';
import type { AppPreferences } from '@bitakit/app-preferences/core';
import PuzzleIcon from 'reicon-react/icons/Puzzle';

/** The Plugins section that renders the overview and, with `?plugin=<id>`, one plugin. */
export const pluginOverviewSection = 'plugins';

/**
 * Publishes one URL Action per composed plugin that opens its view in the plugin overview, so
 * search can find plugins. Names, descriptions and icons come from plugin metadata; visibility
 * and availability follow the overview section. The registrations leave with Shell.
 */
export function bindPluginResults(
  scope: PluginScope,
  settings: AppPreferences,
  i18n?: TranslationService,
) {
  const target = scope.actions.getGroup('shell.plugins');
  const registrations = new Map<string, ReturnType<typeof target.add>>();
  const sync = () => {
    const overview = settings.getSection(pluginOverviewSection);
    const text = (key: string, fallback: string) =>
      i18n ? resolveText(i18n.translate, key, fallback) : fallback;
    const heading = new ActionGroup('shell.plugins.heading', text('shell.ui.plugins', 'Plugins'));
    for (const plugin of scopePlugins(scope)) {
      const definition = {
        id: `shell.plugins.${plugin.id}`,
        title: text(`plugins.${plugin.id}.name`, plugin.metadata?.name ?? plugin.id),
        description:
          text(`plugins.${plugin.id}.description`, plugin.metadata?.description ?? '') || undefined,
        icon: plugin.metadata?.icon ?? PuzzleIcon,
        href: `/settings/${overview?.path ?? pluginOverviewSection}?${new URLSearchParams({ plugin: plugin.id })}`,
        visible: !!overview?.visible,
        enabled: !!overview?.enabled,
        metadata: destinationMetadata({ kind: 'plugin', plugin: plugin.id }),
        groups: [heading],
      };
      const existing = registrations.get(plugin.id);
      if (existing) existing.update(definition);
      else registrations.set(plugin.id, target.add(definition));
    }
  };
  sync();
  const unsubscribe = settings.subscribeSections(sync);
  const stopTranslation = i18n?.subscribe(sync);
  return () => {
    unsubscribe();
    stopTranslation?.();
    for (const registration of registrations.values()) registration.dispose();
    registrations.clear();
  };
}
