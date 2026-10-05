'use client';
import { useCallback, type ComponentType } from 'react';
import { useSlot } from './use-slot.js';
import { useFoundation } from '../providers/foundation-context.js';
import { useFoundationNavigation } from './use-foundation-navigation.js';
import type { ActionControl } from './use-action.js';

export type Navigation = {
  items: readonly (ActionControl & { key: string })[];
  pending: boolean;
  error?: Error;
  pathname?: string;
  Link?: ComponentType<any>;
  navigate?: (href: string) => void;
  isActive(href: string | undefined): boolean;
};
/** Explicit Action placements and native router bindings for one navigation region. */
export function useNavigation(slot = 'shell.navigation'): Navigation {
  const view = useSlot(slot);
  const { runtime } = useFoundation();
  const { pathname, Link, navigate } = useFoundationNavigation();
  const isActive = useCallback(
    (href: string | undefined) => href !== undefined && href.split(/[?#]/)[0] === pathname,
    [pathname],
  );
  return {
    items: view.items.flatMap((item) =>
      item.kind === 'action' ? [{ ...item.action, key: item.key }] : [],
    ),
    pending: view.pending,
    error:
      view.error ??
      (runtime.slots.has(slot)
        ? undefined
        : new Error(`Navigation slot "${slot}" has no owning definition.`)),
    pathname,
    Link,
    navigate,
    isActive,
  };
}
