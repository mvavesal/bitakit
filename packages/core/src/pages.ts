import type {
  Plugin,
  PluginPageDefinition,
  PluginView,
  ProviderDefinition,
  PluginSettingsPage,
} from './definitions.js';
import { setContributionSource } from './contribution-origin.js';
import type { PresentationType } from './presentation.js';
import { BitaKitStartupError } from './startup-error.js';

/** Exact, canonical paths only. Routers remain responsible for dynamic parameters. */
export function validatePluginPages(
  plugins: readonly { id: string; pages?: readonly PluginPageDefinition[] }[],
  layouts: ReadonlySet<string> = new Set(),
) {
  const owners = new Map<string, string>();
  for (const plugin of plugins) {
    for (const page of plugin.pages ?? []) {
      if (
        page.layout &&
        page.layout !== 'app' &&
        page.layout !== 'blank' &&
        !layouts.has(page.layout)
      )
        throw new BitaKitStartupError(
          `Page ${page.path} of plugin "${plugin.id}" names layout "${page.layout}", but src/layouts/${page.layout}.tsx does not exist.${layouts.size ? ` Known layouts: ${[...layouts].join(', ')}.` : ''} Use "app", "blank" or an existing layout.`,
          plugin.id,
        );
      if (
        !/^\/(?:(?:[a-zA-Z0-9_-]+|\[[a-zA-Z0-9_-]+\])(?:\/(?:[a-zA-Z0-9_-]+|\[[a-zA-Z0-9_-]+\]))*)?$/.test(
          page.path,
        )
      )
        throw new BitaKitStartupError(
          `Invalid plugin page path "${page.path}" in plugin "${plugin.id}". Use a root-relative path such as /todos.`,
          plugin.id,
        );
      const owner = owners.get(page.path);
      if (owner)
        throw new BitaKitStartupError(
          `Plugins "${owner}" and "${plugin.id}" both define a page at ${page.path}.`,
          plugin.id,
        );
      owners.set(page.path, plugin.id);
    }
  }
}
/** Matches one registered path against a pathname; `[id]` segments capture parameters. */
function matchPath(pattern: string, pathname: string): Record<string, string> | undefined {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const match = /^\[(.+)\]$/.exec(segment);
    if (match) params[match[1]] = decodeURIComponent(actual[index]);
    else if (segment !== actual[index]) return undefined;
  }
  return params;
}
/**
 * The registered page for a pathname, with its parameters and the ID of the module that owns
 * it. Exact paths win over parameterized ones.
 */
export function findPluginPage(
  plugins: readonly { id: string; pages?: readonly PluginPageDefinition[] }[],
  pathname: string,
) {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  let fallback:
    | (PluginPageDefinition & { plugin: string; key: string; params: Record<string, string> })
    | undefined;
  for (const plugin of plugins) {
    for (const page of plugin.pages ?? []) {
      if (page.path === path)
        return { ...page, plugin: plugin.id, key: `${plugin.id}:${page.path}`, params: {} };
      if (!fallback && page.path.includes('[')) {
        const params = matchPath(page.path, path);
        if (params)
          fallback = { ...page, plugin: plugin.id, key: `${plugin.id}:${page.path}`, params };
      }
    }
  }
  return fallback;
}

type Exported<T> = {
  default: T;
  layout?: string;
  order?: number;
  key?: string;
  when?: PluginView['when'];
  boundary?: PresentationType<'component'>;
  availability?: import('./slots/types.js').SlotAvailability;
  requires?: readonly string[];
  id?: string;
};
/** A page from `ui/pages/<path>.tsx`: the default export is the component; the path comes from the file. */
export function pluginPage(module: Exported<unknown>, path: string): PluginPageDefinition {
  const value = module.default as PluginPageDefinition | PresentationType<'component'>;
  if (value && typeof value === 'object' && 'component' in value)
    return value as PluginPageDefinition;
  return { path, component: value as PresentationType<'component'>, layout: module.layout };
}
/** A slot view from `ui/slots/<slot>.tsx`. */
export function pluginSlot(module: Exported<unknown>, slot: string, source?: string): PluginView {
  const value = module.default as PluginView | PresentationType<'component'>;
  const view: PluginView =
    value && typeof value === 'object' && 'component' in value
      ? { ...(value as PluginView), slot: (value as PluginView).slot ?? slot }
      : {
          slot,
          component: value as PresentationType<'component'>,
          order: module.order,
          ...(module.id === undefined ? {} : { id: module.id }),
          ...(module.key === undefined ? {} : { key: module.key }),
          ...(module.availability === undefined ? {} : { availability: module.availability }),
          ...(module.when === undefined ? {} : { when: module.when }),
        };
  if (source) setContributionSource(view, source);
  return view;
}
/** A layout from `src/layouts/<name>.tsx`: the default export wraps pages that name it. */
export function pluginLayout(module: Exported<unknown>): PresentationType<'component'> {
  return module.default as PresentationType<'component'>;
}
/** The settings page from `ui/settings/page.tsx`; it replaces the generated page of the plugin. */
export function pluginSettingsPage(module: Exported<unknown>): PluginSettingsPage {
  const value = module.default as PluginSettingsPage | PresentationType<'component'>;
  if (value && typeof value === 'object' && ('component' in value || 'pages' in value))
    return value as PluginSettingsPage;
  return { component: value as PresentationType<'component'>, boundary: module.boundary };
}
/** A React provider from `ui/providers/<name>.tsx`. */
export function pluginProvider(module: Exported<unknown>, id: string): ProviderDefinition {
  const value = module.default as ProviderDefinition | PresentationType<'provider'>;
  if (value && typeof value === 'object' && 'component' in value)
    return value as ProviderDefinition;
  return {
    id: module.id ?? id,
    component: value as PresentationType<'provider'>,
    requires: module.requires,
  };
}
