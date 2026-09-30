'use client';
import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

/** Shares Next navigation bindings between the standalone and composed providers. */
export function useActionNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const navigate = useCallback(
    (href: string) => {
      if (/^https?:/i.test(href)) window.location.assign(href);
      else router.push(href);
    },
    [router],
  );
  return { navigate, Link, pathname: pathname ?? undefined };
}
