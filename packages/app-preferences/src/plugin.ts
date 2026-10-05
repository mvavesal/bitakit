import { definePlugin, defineSettings, scopeModules, scopeTranslation } from '@bitakit/core';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import SettingIcon from 'reicon-react/icons/Setting';
import { PluginsOverview } from './components/plugins-overview.js';
import { settingsSlots } from './slots.js';
import { pluginId } from './id.js';
import { bindSettingsNavigation } from './navigation.js';
import { defaultBasePath } from './paths.js';

export type AppPreferencesPluginOptions = {
  /** Where the host mounts `SettingsRoute`; navigation and search link there. Default `/settings`. */
  basePath?: string;
  /** Action groups the "Settings" entry joins. Default `['navigation']`. */
  groups?: readonly string[];
  /** Explicit placement targets; default is Shell navigation when installed. Empty omits placement. */
  slots?: readonly string[];
};

/**
 * The settings UI as a plugin: the Plugins settings page, and URL Actions for every settings
 * page, the settings entry and every plugin, so navigation and search reach them. Values,
 * definitions and storage belong to Core (`defineSettings`, `settings.storage`).
 */
export function appPreferencesPlugin(options: AppPreferencesPluginOptions = {}) {
  const basePath = (options.basePath ?? defaultBasePath).replace(/\/+$/, '') || '/';
  const groups = options.groups ?? ['navigation'];
  return definePlugin({
    id: pluginId,
    slots: settingsSlots,
    metadata: {
      tags: ['system'],
      name: 'App Preferences',
      description: 'Settings pages, setting controls and their navigation.',
      icon: SettingIcon,
    },
    settings: defineSettings(
      {},
      {
        title: 'Plugins',
        description: 'Installed plugins and their settings.',
        icon: PuzzleIcon,
        category: 'plugins',
        path: 'plugins',
        order: 90,
      },
    ),
    ui: { settings: { component: PluginsOverview, showHeader: false }, providers: [] },
    setup: ({ app }) => {
      if (!basePath.startsWith('/'))
        throw new Error(`basePath "${basePath}" must start with "/", for example "/settings".`);
      const modules = scopeModules(app);
      return bindSettingsNavigation(app, {
        modules,
        appId: modules.find((module) => module.app)?.id ?? 'app',
        translation: scopeTranslation(app),
        basePath,
        groups,
        slots: options.slots,
      });
    },
  });
}
