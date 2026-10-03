import type { FoundationConfig, Plugin, ProviderDefinition } from './definitions.js';

export type FoundationOverrides = Pick<FoundationConfig, 'actions' | 'plugins' | 'interceptors'> & {
  /** Replaces the app's React providers (`ui.providers`); plugin providers are added unless this is set. */
  providers?: readonly ProviderDefinition[];
};
const providersOf = (plugin: Pick<Plugin, 'ui'>): readonly ProviderDefinition[] =>
  plugin.ui?.providers ?? [];

/** Undefined inherits. An explicit list replaces that domain, including an empty list. */
export function resolveFoundationConfig(
  discovered: FoundationConfig,
  overrides: FoundationOverrides = {},
): FoundationConfig {
  const selectedPlugins = overrides.plugins ?? discovered.plugins ?? [];
  const config: FoundationConfig = {
    ...discovered,
    plugins:
      overrides.actions === undefined && overrides.interceptors === undefined
        ? selectedPlugins
        : selectedPlugins.map((plugin) => ({
            ...plugin,
            ...(overrides.actions === undefined ? {} : { actions: [] }),
            ...(overrides.interceptors === undefined ? {} : { interceptors: [] }),
          })),
    actions: overrides.actions ?? discovered.actions ?? [],
    interceptors: overrides.interceptors ?? discovered.interceptors ?? [],
  };
  const removed = new Set(
    (discovered.plugins ?? [])
      .filter((plugin) => !selectedPlugins.some((selected) => selected.id === plugin.id))
      .map((plugin) => plugin.id),
  );
  if (config.configOverrides)
    config.configOverrides = Object.fromEntries(
      Object.entries(config.configOverrides).filter(([id]) => !removed.has(id)),
    );
  const pluginIds = new Set<string>();
  for (const plugin of config.plugins ?? []) {
    if (!plugin.id || pluginIds.has(plugin.id))
      throw new Error(`Invalid or duplicate plugin "${plugin.id}".`);
    pluginIds.add(plugin.id);
  }
  const pluginProviders = (config.plugins ?? []).flatMap((plugin) => providersOf(plugin));
  const providers =
    overrides.providers === undefined
      ? [...pluginProviders, ...providersOf(discovered)]
      : overrides.providers;
  const seen = new Set<string>();
  for (const provider of providers) {
    if (!provider.id || seen.has(provider.id))
      throw new Error(`Invalid or duplicate provider "${provider.id}".`);
    for (const id of provider.requires ?? []) {
      if (!seen.has(id)) throw new Error(`Provider "${provider.id}" requires "${id}" before it.`);
    }
    seen.add(provider.id);
  }
  config.ui = { ...discovered.ui, providers };
  return config;
}
