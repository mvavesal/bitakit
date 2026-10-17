'use client';
import { defineAction, definePlugin } from '@bitakit/core';
import SearchIcon from 'reicon-react/icons/Search';
import { QuickSearchTrigger } from './trigger.js';
import { SearchResults, type QuickSearchResults } from './search-results.js';

export { quickSearchActionId } from './constants.js';
export type { QuickSearchResults } from './search-results.js';
/** Installed packages read these from the app's `src/configs/quick-search.ts`. */
export type QuickSearchOptions = {
  title?: string;
  placeholder?: string;
  empty?: string;
  /** Uses the root ActionProvider shortcut owner; false disables the shortcut. */
  shortcut?: string | false;
  /** Result types to include; omitted types keep their defaults (pages, settings and plugins on). */
  results?: QuickSearchResults;
};

/** A normal dialog Action; no second provider, service, registry or navigation dispatcher. */
export function quickSearchPlugin(options: QuickSearchOptions = {}) {
  const title = options.title ?? 'Quick search';
  const shortcut = options.shortcut ?? 'Mod+K';
  return definePlugin({
    id: 'quick-search',
    ui: { slots: [{ slot: 'app-bar.end', component: QuickSearchTrigger }] },
    // The record key gives the ID "quick-search.open" (quickSearchActionId) and lets host
    // generation type it, which an explicit ID in an array cannot.
    actions: {
      open: defineAction({
        title,
        icon: SearchIcon,
        shortcut: shortcut ? { keys: shortcut } : undefined,
        dialog: {
          kind: 'command',
          size: 'wide',
          component: ({ close }: { close: () => void }) => (
            <SearchResults
              close={close}
              label={title}
              placeholder={options.placeholder ?? 'Search pages…'}
              empty={options.empty ?? 'No results found.'}
              results={options.results}
            />
          ),
        },
      }),
    },
  });
}
