'use client';
import { useCallback } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import type { Router } from '@bitakit/ui';

/** Next routing as the shared router contract: pathname, params, navigate and Link. */
export function useActionNavigation(): Router {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as Readonly<Record<string, string>> | null;
  const navigate = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (/^https?:/i.test(href)) window.location.assign(href);
      else if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );
  return { navigate, Link, pathname: pathname ?? undefined, params: params ?? undefined };
}
