import type { Plugin } from './definitions.js';

/** Exact, canonical paths only. Routers remain responsible for dynamic parameters. */
export function validatePluginPages(plugins: readonly Plugin[]) {
  const paths = new Set<string>();
  for (const plugin of plugins) {
    for (const page of plugin.pages ?? []) {
      if (!/^\/(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/.test(page.path))
        throw new Error(`Invalid plugin page path "${page.path}" in "${plugin.id}".`);
      if (paths.has(page.path)) throw new Error(`Duplicate plugin page path "${page.path}".`);
      paths.add(page.path);
    }
  }
}
export function findPluginPage(plugins: readonly Plugin[], pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  for (const plugin of plugins) {
    const page = plugin.pages?.find((entry) => entry.path === path);
    if (page) return { ...page, key: `${plugin.id}:${page.path}` };
  }
  return undefined;
}
