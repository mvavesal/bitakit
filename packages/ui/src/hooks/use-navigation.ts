'use client';
import { useCallback, type ComponentType } from 'react';
import { useActionGroups, type BoundGroup } from './use-action-group.js';
import { useFoundationNavigation } from './use-foundation-navigation.js';

export type Navigation = {
  /** Visible navigation actions per group, ordered, bound as controls. */
  groups: readonly BoundGroup[];
  pathname?: string;
  Link?: ComponentType<any>;
  navigate?: (href: string) => void;
  /** Exact match of the path part against the current pathname. */
  isActive(href: string | undefined): boolean;
};
const defaultGroups = ['navigation'] as const;
/**
 * Everything a layout needs to render app navigation: the bound action groups plus the
 * framework adapter's pathname, link component and navigate function.
 */
export function useNavigation(groups: readonly string[] = defaultGroups): Navigation {
  const bound = useActionGroups(groups);
  const { pathname, Link, navigate } = useFoundationNavigation();
  const isActive = useCallback(
    (href: string | undefined) => href !== undefined && href.split(/[?#]/)[0] === pathname,
    [pathname],
  );
  return { groups: bound, pathname, Link, navigate, isActive };
}
