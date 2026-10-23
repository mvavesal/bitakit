import type { ActionList, BitaKitRuntime } from '@bitakit/core';

/** Literal text, or a translation key and fallback owned by the contributing plugin. */
export type SearchText = string | { key: string; fallback: string };
export type SearchCategory = { id: string; title: SearchText };
/** Action results retain references only; their presentation and guards remain in ActionList. */
export type SearchResult =
  | { id: string; actionId: string; keywords?: string[]; detail?: string }
  | { id: string; title: string; href: string; description?: string; keywords?: string[] };
export type SearchContext = {
  query: string;
  signal: AbortSignal;
  /** The existing host runtime/list, also used by the built-in destination sources. */
  runtime: BitaKitRuntime;
  actions: ActionList;
  text(value: SearchText): string;
  groupTitle(group: { id: string; title?: string }): string;
  /** The palette's established cmdk matcher, for local sources; remote sources may rank themselves. */
  score(value: string, keywords?: string[]): number;
};
export type SearchSource = {
  title: SearchText;
  description: SearchText;
  category: SearchCategory;
  defaultEnabled: boolean;
  search(context: SearchContext): readonly SearchResult[] | Promise<readonly SearchResult[]>;
  /** Resolve a stored ID against current access/data. Return null for removed or inaccessible items. */
  resolve(id: string, context: SearchContext): SearchResult | null | Promise<SearchResult | null>;
};
/** Stable identity is the owned data-slot contribution ID (set `id` explicitly in setup). */
export type RegisteredSource = { id: string; plugin: string; source: SearchSource };
export type QuickSearchResults = { pages?: boolean; settings?: boolean; plugins?: boolean };
export type SearchEnvironment = Omit<SearchContext, 'query' | 'signal' | 'score'> & {
  score(value: string, query: string, keywords?: string[]): number;
};
