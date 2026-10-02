'use client';
import { useContext, type ComponentType } from 'react';
import { UIContext } from '../providers/action-context.js';

/**
 * The host router's current pathname, link component and navigate function, as supplied by the
 * framework adapter (Next.js or TanStack). Lets route components work without router imports.
 */
export function useFoundationNavigation(): {
  pathname?: string;
  Link?: ComponentType<any>;
  navigate?: (href: string) => void;
} {
  const { pathname, Link, navigate } = useContext(UIContext);
  return { pathname, Link, navigate };
}
