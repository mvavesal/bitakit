import {
  safeHref,
  type ActionSnapshot,
  type Destination,
  type DestinationKind,
} from '@bitakit/core';
import type { QuickSearchResults, SearchContext, SearchResult, SearchSource } from './types.js';

const definitions = [
  {
    id: 'pages',
    kind: 'page',
    title: 'Pages',
    description: 'Pages and navigation links in this app.',
  },
  {
    id: 'settings',
    kind: 'settings',
    title: 'Settings',
    description: 'Settings pages contributed by plugins.',
  },
  {
    id: 'plugins',
    kind: 'plugin',
    title: 'Plugins',
    description: 'Installed plugins and their details.',
  },
] as const;
const names: Record<DestinationKind, string> = {
  page: 'Page',
  settings: 'Settings',
  plugin: 'Plugin',
};

/** Deduplicate before classifying so a shortcut does not disguise a Settings destination as a page. */
function destinations(context: SearchContext) {
  const found = new Map<string, { action: ActionSnapshot; destination?: Destination }>();
  for (const id of Object.keys(context.actions.getState().actions)) {
    const action = context.actions.resolve(id);
    const href = action && safeHref(action.href);
    if (!action?.visible || action.internal || !href) continue;
    const previous = found.get(href);
    const next = context.runtime.destinationOf(action);
    found.set(href, {
      action:
        !previous || (!previous.action.shortcut && action.shortcut) ? action : previous.action,
      destination:
        previous?.destination && previous.destination.kind !== 'page'
          ? previous.destination
          : (next ?? previous?.destination),
    });
  }
  return [...found.values()].sort((a, b) => (a.action.order ?? 0) - (b.action.order ?? 0));
}
function result(
  context: SearchContext,
  action: ActionSnapshot,
  destination?: Destination,
): SearchResult {
  let detail: string | undefined;
  if (destination) {
    detail = context.text({
      key: `quickSearch.kinds.${destination.kind}`,
      fallback: names[destination.kind],
    });
    if (destination.plugin && destination.kind !== 'plugin') {
      const plugin = context.runtime.modules.find((module) => module.id === destination.plugin);
      detail += ` · ${context.text({ key: `plugins.${destination.plugin}.name`, fallback: plugin?.metadata?.name ?? destination.plugin })}`;
    }
  }
  return {
    id: action.id,
    actionId: action.id,
    detail,
    keywords: [
      action.title,
      action.description ?? '',
      detail ?? '',
      ...(action.groups ?? []).map(context.groupTitle),
    ],
  };
}

/** Built-ins are ordinary data contributions, with the legacy switches as source defaults. */
export function destinationSources(
  options: QuickSearchResults = {},
): { id: string; source: SearchSource }[] {
  return definitions.map(({ id, kind, title, description }) => ({
    id,
    source: {
      title: { key: `quickSearch.sources.${id}.title`, fallback: title },
      description: { key: `quickSearch.sources.${id}.description`, fallback: description },
      category: { id, title: { key: `quickSearch.sources.${id}.title`, fallback: title } },
      defaultEnabled: options[id] ?? true,
      search(context) {
        return destinations(context)
          .filter((item) => (item.destination?.kind ?? 'page') === kind)
          .map(({ action, destination }) => result(context, action, destination))
          .map((item) => ({
            item,
            score: context.query ? context.score(item.id, item.keywords) : 1,
          }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ item }) => item);
      },
      resolve(id, context) {
        const item = destinations(context).find(
          (item) => item.action.id === id && (item.destination?.kind ?? 'page') === kind,
        );
        return item ? result(context, item.action, item.destination) : null;
      },
    },
  }));
}
