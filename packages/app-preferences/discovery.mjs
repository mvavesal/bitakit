/**
 * Discovery kinds for foundation.config.ts. Node-safe: it only describes folders and normalizers;
 * discovery emits imports and never executes contribution modules.
 */
export function settingsDiscovery({ directories = {} } = {}) {
  const from = '@bitakit/app-preferences/foundation';
  return [
    {
      name: 'settings',
      directory: directories.settings ?? 'settings',
      from,
      normalize: 'discoverSettings',
      types: { entry: 'DiscoveredSettingsEntry', map: 'PublicSettingsMap' },
    },
    {
      name: 'settings.sections',
      directory: directories.sections ?? 'sections',
      from,
      normalize: 'discoverSettingsSections',
    },
    {
      name: 'settings.renderers',
      directory: directories.renderers ?? 'renderers',
      from,
      normalize: 'discoverSettingsRenderers',
    },
  ];
}
export default settingsDiscovery;
