import { forwardRef, useCallback, type ComponentPropsWithoutRef } from 'react';
import { Link, useRouter, useLocation } from '@tanstack/react-router';

/** Bridges Foundation href links; app-owned typed routes should use TanStack Link directly. */
export const FoundationLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(
  function FoundationLink({ href, ...props }, ref) {
    return <Link {...props} ref={ref} to={href} />;
  },
);

/** Adapts native routing without mirroring location into another store. */
export function useActionNavigation() {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useCallback(
    (href: string) => {
      if (/^https?:/i.test(href)) window.location.assign(href);
      else void router.navigate({ href });
    },
    [router],
  );
  return { navigate, Link: FoundationLink, pathname };
}
