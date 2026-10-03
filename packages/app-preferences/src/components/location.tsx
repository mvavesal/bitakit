'use client';
import { createContext, useContext, type ElementType } from 'react';
import { useFoundationNavigation } from '@bitakit/ui';
import { defaultBasePath } from '../paths.js';

export type SettingsLocation = {
  /** Where the settings route lives, for example `/settings`. */
  readonly basePath: string;
  /** The current settings path; undefined when neither props nor the router supply one. */
  readonly pathname?: string;
  readonly Link: ElementType;
};
/**
 * Set by `SettingsRoute` and `SettingsShell` so pages inside them, including plugin pages that
 * receive no props, link within the same settings route. Not a store: it only forwards props.
 */
export const SettingsLocationContext = createContext<Partial<SettingsLocation> | null>(null);

/** Explicit props first, then the surrounding settings route, then the framework adapter. */
export function useSettingsLocation(props: {
  basePath?: string;
  pathname?: string;
  Link?: ElementType;
}): SettingsLocation {
  const outer = useContext(SettingsLocationContext);
  const navigation = useFoundationNavigation();
  return {
    basePath: props.basePath ?? outer?.basePath ?? defaultBasePath,
    pathname: props.pathname ?? outer?.pathname ?? navigation.pathname,
    Link: props.Link ?? outer?.Link ?? navigation.Link ?? 'a',
  };
}
