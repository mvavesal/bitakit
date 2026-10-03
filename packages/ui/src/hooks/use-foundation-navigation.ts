'use client';
import { useContext, type ComponentType } from 'react';
import { UIContext } from '../providers/action-context.js';

/**
 * The host router's current pathname, link component and navigate function, as supplied by the
 * framework adapter (Next.js or TanStack). Lets route components work without router imports.
 */
export function useFoundationNavigation(): {
  pathname?: string;
  params?: Readonly<Record<string, string>>;
  Link?: ComponentType<any>;
  navigate?: (href: string, options?: { replace?: boolean }) => void;
} {
  const { pathname, params, Link, navigate } = useContext(UIContext);
  return { pathname, params, Link, navigate };
}
