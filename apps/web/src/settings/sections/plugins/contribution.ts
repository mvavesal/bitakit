import { SettingsSection } from '@bitakit/app-preferences';
import { PluginsSettings } from './plugins-settings';

/** Stable parent for settings pages contributed by plugins. */
export function pluginsSettings(t: (key: string) => string) {
  return new SettingsSection({
    id: 'plugins',
    title: t('PluginsSettings.title'),
    description: t('PluginsSettings.description'),
    component: PluginsSettings,
  });
}
