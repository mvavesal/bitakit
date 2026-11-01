'use client';
import { defineAction, definePlugin } from '@bitakit/core';
import SearchIcon from 'reicon-react/icons/Search';
import { QuickSearchTrigger } from './trigger.js';
import { SearchResults } from './ui/search-results.js';
import type { QuickSearchResults } from './types.js';
import { quickSearchSettings } from './settings.js';
import { searchSources } from './slots.js';
import { searchService } from './service.js';
import { destinationSources } from './destination-sources.js';
import { SearchSettingsPage } from './ui/settings/page.js';

export { quickSearchActionId } from './constants.js';
export type { QuickSearchResults } from './types.js';
/** Installed packages read these from the app's `src/configs/quick-search.ts`. */
export type QuickSearchOptions = {
  title?: string;
  placeholder?: string;
  empty?: string;
  /** Uses the root ActionProvider shortcut owner; false disables the shortcut. */
  shortcut?: string | false;
  /** Initial built-in source defaults (all on); a saved user override takes precedence. */
  results?: QuickSearchResults;
};

/** A normal plugin: one data-slot contract, one coordinator and the existing dialog Action. */
export function quickSearchPlugin(options: QuickSearchOptions = {}) {
  const title = options.title ?? 'Quick search';
  const shortcut = options.shortcut ?? 'Mod+K';
  return definePlugin({
    id: 'quick-search',
    metadata: {
      name: 'Quick search',
      description:
        'BitaKit Quick Search: plugin-owned search sources, navigation, preferences and recent history.',
      tags: ['system'],
      icon: SearchIcon,
    },
    settings: quickSearchSettings,
    slots: { sources: searchSources },
    services: { search: searchService },
    setup({ scope }) {
      const handles = destinationSources(options.results).map(({ id, source }) =>
        scope.slots.attach(
          { slot: 'quick-search.sources', id, data: source },
          { availability: 'wait' },
        ),
      );
      return () => {
        for (const handle of handles) handle.dispose();
      };
    },
    ui: {
      slots: [{ slot: 'app-bar.end', component: QuickSearchTrigger }],
      settings: { component: SearchSettingsPage },
    },
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
              placeholder={options.placeholder ?? 'Search…'}
              empty={options.empty ?? 'No results found.'}
            />
          ),
        },
      }),
    },
  });
}
