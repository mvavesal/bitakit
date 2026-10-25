import {
  defineAction,
  definePlugin,
  defineSettings,
  getService,
  scopeModules,
  scopeTranslation,
} from '@bitakit/core';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import SearchIcon from 'reicon-react/icons/Search';
import SettingIcon from 'reicon-react/icons/Setting';
import { PluginsOverview } from './components/plugins-overview.js';
import { settingsSlots } from './slots.js';
import { pluginId } from './id.js';
import { bindSettingsNavigation } from './navigation.js';
import { defaultBasePath } from './paths.js';
import { settingsSearch, settingsSearchService } from './search-target.js';

export type AppPreferencesPluginOptions = {
  /** Where the host mounts `SettingsRoute`; navigation and search link there. Default `/settings`. */
  basePath?: string;
  /** Action groups the "Settings" entry joins. Default `['navigation']`. */
  groups?: readonly string[];
  /** Explicit placement targets; default is Shell navigation when installed. Empty omits placement. */
  slots?: readonly string[];
  /** Focuses the settings search while Settings is open. Default `/`; false turns it off. */
  searchShortcut?: string | false;
};

/**
 * The settings UI as a plugin: the Plugins settings page, and URL Actions for every settings
 * page, the settings entry and every plugin, so navigation and search reach them. Values,
 * definitions and storage belong to Core (`defineSettings`, `settings.storage`).
 */
export function appPreferencesPlugin(options: AppPreferencesPluginOptions = {}) {
  const basePath = (options.basePath ?? defaultBasePath).replace(/\/+$/, '') || '/';
  const groups = options.groups ?? ['navigation'];
  const searchShortcut = options.searchShortcut ?? '/';
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
    services: { search: settingsSearchService },
    actions: {
      search: defineAction({
        title: 'Search settings',
        icon: SearchIcon,
        shortcut: searchShortcut ? { keys: searchShortcut } : undefined,
        visible: ({ services }) => getService(services, settingsSearch).shown(),
        execute: ({ services }) => getService(services, settingsSearch).focus(),
      }),
    },
    ui: { settings: { component: PluginsOverview, showHeader: false }, providers: [] },
    setup: ({ scope }) => {
      if (!basePath.startsWith('/'))
        throw new Error(`basePath "${basePath}" must start with "/", for example "/settings".`);
      const modules = scopeModules(scope);
      return bindSettingsNavigation(scope, {
        modules,
        appId: modules.find((module) => module.app)?.id ?? 'app',
        translation: scopeTranslation(scope),
        basePath,
        groups,
        slots: options.slots,
      });
    },
  });
}
