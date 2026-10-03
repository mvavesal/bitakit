'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, useFoundationApp } from '@bitakit/ui';
import { Auth, AuthPageLayout, UserButton } from '@bitakit/better-auth-ui';
import { OrganizationSwitcher } from '@bitakit/better-auth-ui/plugins/organization';
import { AppShell } from '@bitakit/shell';

export function Workspace({ children }: { children: ReactNode }) {
  const { ready } = useFoundationApp();
  const session = useAuth();
  const pathname = usePathname();
  if (!ready || session.pending) return <p role="status">Loading preview…</p>;
  if (pathname.startsWith('/auth/')) return children;
  if (!session.user) return <AuthPageLayout>
    <p>Temporary local preview. Sign in with the demo account provided alongside this preview.</p>
    <Auth view="signIn" />
  </AuthPageLayout>;
  return <AppShell
    brand={<OrganizationSwitcher aria-label="Switch organization" hidePersonal hideSettings />}
    account={<UserButton hideSettings links={[{ label: 'Account settings', href: '/settings/account', visibility: 'authenticated' }]} />}
    header={<span>To-do preview · temporary local data</span>}
  >{children}</AppShell>;
}
