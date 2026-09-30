'use client';
import '../styles.css';
import { defineDialogAction, definePlugin } from '@bitakit/core';
import SearchIcon from 'reicon-react/icons/Search';
import { QuickSearchTrigger } from './trigger.js';
import { SearchResults } from './search-results.js';

import { quickSearchActionId } from './constants.js';
export { quickSearchActionId } from './constants.js';
export type QuickSearchOptions = {
  title?: string;
  placeholder?: string;
  empty?: string;
  /** Uses the root ActionProvider shortcut owner; false disables the shortcut. */
  shortcut?: string | false;
};

/** A normal dialog Action; no second provider, service, registry or navigation dispatcher. */
export function quickSearchPlugin(options: QuickSearchOptions = {}) {
  const title = options.title ?? 'Schnellsuche';
  const shortcut = options.shortcut ?? 'Mod+K';
  return definePlugin({
    id: 'quick-search',
    views: [{ slot: 'app-bar.end', component: QuickSearchTrigger }],
    actions: [defineDialogAction({
      id: quickSearchActionId,
      title,
      size: 'wide',
      icon: SearchIcon,
      shortcut: shortcut ? { keys: shortcut } : undefined,
      render: ({ close }) => <SearchResults close={close} label={title}
        placeholder={options.placeholder ?? 'Seiten suchen …'}
        empty={options.empty ?? 'Keine Ergebnisse gefunden.'} />,
    })],
  });
}
