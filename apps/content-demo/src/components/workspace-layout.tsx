'use client';
import { useTranslation } from '@bitakit/ui';
import { OrganizationSwitcher } from '@bitakit/better-auth-ui/plugins/organization';
import { AppShell, SettingsShell, useShellLayout } from '@bitakit/shell';
import { useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { authService, getService } from '@bitakit/core';
import { Auth, AuthPageLayout, UserButton } from '@bitakit/better-auth-ui';
import { useFoundationReady, useFoundation } from '@bitakit/ui';
import SettingsIcon from 'reicon-react/icons/Settings';
import { Badge } from '@bitakit/ui/components';


function Workspace({ children }: { children: ReactNode }) {
  const translateUI = useTranslation();
  const { runtime } = useFoundation();
  const auth = getService(runtime.services, authService);
  const session = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
  const path = usePathname();
  const layout = useShellLayout();
  if (session.pending) return <p role="status">{translateUI("foundationUI.workspace_layout.checkingSignin", undefined, "Anmeldung wird geprüft …")}</p>;
  if (!session.user) return <AuthPageLayout><Auth view="signIn" /></AuthPageLayout>;
  if (path === '/settings' || path.startsWith('/settings/'))
    return (
      <SettingsShell pathname={path} linkComponent={Link} backHref="/">
        {children}
      </SettingsShell>
    );
  return (
    <AppShell
      brand={<OrganizationSwitcher className={layout === 'navbar' ? 'auth-identity-trigger w-fit max-w-full' : 'auth-identity-trigger w-full justify-between'} hidePersonal hideSettings hideSlug={false} aria-label={translateUI("foundationUI.workspace_layout.switchOrganization", undefined, "Organisation wechseln")} placement={layout === 'navbar' ? 'bottom start' : 'right top'} />}
      account={
        (
          <UserButton
            className={layout === 'navbar' ? 'auth-identity-trigger' : 'auth-identity-trigger w-full justify-start'}
            placement="bottom end"
            hideSettings
            links={[
              {
                label: translateUI("foundationUI.workspace_layout.settings", undefined, "Einstellungen"),
                href: '/settings/profile',
                icon: <SettingsIcon aria-hidden="true" />,
                visibility: 'authenticated',
              },
            ]}
          />
        )
      }
      header={
        <>
          <span className="text-sm font-medium">Content Studio</span>
          <Badge variant="outline" className="ml-auto">
            {translateUI("foundationUI.workspace_layout.workspace", undefined, "Workspace")}</Badge>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const ready = useFoundationReady();
  return ready ? <Workspace>{children}</Workspace> : null;
}
