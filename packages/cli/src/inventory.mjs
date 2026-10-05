import { createInventory } from '@bitakit/core';

/** Static source evidence only. File collections and package plugin IDs stay explicitly unresolved. */
export function inspectionFromDescription(description) {
  const kinds = {
    services: 'service',
    actions: 'action',
    events: 'event',
    settings: 'setting',
    pages: 'page',
    slots: 'widget',
    slotDefinitions: 'slot',
    providers: 'provider',
    configs: 'config',
    interceptors: 'interceptor',
  };
  const plugins = [description.app, ...description.plugins].map((module) => ({
    id: module.id,
    pluginId: module.id,
    enabled: module.enabled ?? true,
    source: { kind: 'file', path: module.directory },
    metadata: {},
    dependencies: module.dependencies ?? [],
    declarations: Object.entries(kinds).flatMap(([key, kind]) =>
      (module[key] ?? []).map((entry) => ({
        kind,
        id: null,
        source: entry.file,
        resolution: 'file',
      })),
    ),
  }));
  for (const specifier of description.packages)
    plugins.push({
      id: specifier,
      pluginId: null,
      enabled: true,
      source: { kind: 'package', path: specifier },
      metadata: {},
      dependencies: null,
      declarations: null,
    });
  for (const slot of description.slotDeclarations) {
    const plugin = plugins.find((plugin) => plugin.pluginId === slot.plugin);
    if (plugin)
      plugin.declarations.push({
        kind: 'slot',
        id: slot.id,
        source: slot.file,
        resolution: 'resolved',
      });
  }
  return createInventory(plugins);
}
