'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFoundationApp } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import { AuthPageLayout, UserButton } from '@bitakit/better-auth-ui';
import { OrganizationSwitcher } from '@bitakit/better-auth-ui/plugins/organization';
import { AppShell } from '@bitakit/shell';

export function Workspace({ children }: { children: ReactNode }) {
  const { ready } = useFoundationApp();
  const session = useAuth();
  const pathname = usePathname();
  if (pathname.startsWith('/auth/')) return children;
  if (!ready || session.pending) return <p role="status">Loading preview…</p>;
  if (!session.user) return <AuthPageLayout>
    <p>Temporary local preview. Sign in with the demo account provided alongside this preview.</p>
    <Button asChild><Link href="/auth/sign-in">Sign in</Link></Button>
  </AuthPageLayout>;
  return <AppShell
    brand={<OrganizationSwitcher aria-label="Switch organization" hidePersonal hideSettings />}
    account={<UserButton hideSettings links={[{ label: 'Account settings', href: '/settings/account', visibility: 'authenticated' }]} />}
    header={<span>To-do preview · temporary local data</span>}
  >{children}</AppShell>;
}
