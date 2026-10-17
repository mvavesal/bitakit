import { forwardRef, useCallback, type ComponentPropsWithoutRef } from 'react';
import { Link, useRouter, useLocation, useParams } from '@tanstack/react-router';
import type { Router } from '@bitakit/ui';

/** Bridges BitaKit href links; app-owned typed routes should use TanStack Link directly. */
export const BitaKitLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(
  function BitaKitLink({ href, ...props }, ref) {
    return <Link {...props} ref={ref} to={href} />;
  },
);

/** TanStack routing as the shared router contract; nothing is mirrored into another store. */
export function useActionNavigation(): Router {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const params = useParams({ strict: false }) as Readonly<Record<string, string>>;
  const navigate = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (/^https?:/i.test(href)) window.location.assign(href);
      else void router.navigate({ href, replace: options?.replace });
    },
    [router],
  );
  return { navigate, Link: BitaKitLink, pathname, params };
}
