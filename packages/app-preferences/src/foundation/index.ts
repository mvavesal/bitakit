'use client';
export {
  appPreferencesPlugin,
  scopedSettings,
  type AppPreferencesPluginOptions,
} from '../plugin.js';
export {
  discoverSettings,
  discoverSettingsSections,
  discoverSettingsRenderers,
} from './normalize.js';

export {
  settingsService,
  settingsRendererService,
  SettingsRendererService,
} from '../services/renderers.js';
export { createInitialSettingsSnapshot } from '../providers/foundation.js';

export type { PublicSettingsMap, DiscoveredSettingsEntry } from './app-access.js';
export { appPreferencesPlugin as default } from '../plugin.js';
