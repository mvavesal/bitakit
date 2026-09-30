'use client';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SettingsShell } from '@bitakit/shell';

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Suspense>
      <SettingsShell pathname={pathname} linkComponent={Link} backHref="/">
        {children}
      </SettingsShell>
    </Suspense>
  );
}
