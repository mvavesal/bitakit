/**
 * Implemented API example: two fixed variants, no layout registry.
 * AppLogo, Search and AccountMenu represent application-owned components.
 */
import type { ReactNode } from 'react';
import { AppShell, verticalLayout, type ShellLayout, type ShellLayoutProps } from '@bitakit/shell';
import {
  AppBar,
  ActionNavigationMenu,
  ActionSidebarNavigation,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from '@bitakit/ui/components';

/** Compose a custom sidebar from standard primitives and existing Action bindings. */
function StudioSidebar({ brand, account, ...navigation }: ShellLayoutProps) {
  return (
    <Sidebar side="left" variant="inset">
      <SidebarHeader>{brand}</SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main navigation">
          <ActionSidebarNavigation {...navigation} />
        </nav>
      </SidebarContent>
      <SidebarFooter>{account}</SidebarFooter>
    </Sidebar>
  );
}

/** Place navigation beneath the App Bar; center accepts any React content too. */
function StudioAppBar({ brand, account, header, ...navigation }: ShellLayoutProps) {
  return (
    <AppBar
      left={brand}
      center={header}
      right={account}
      bottom={
        <nav aria-label="Main navigation">
          <ActionNavigationMenu {...navigation} />
        </nav>
      }
    />
  );
}

// Define components outside render so React can retain their identity.
const layouts = {
  sidebar: { ...verticalLayout, Navigation: StudioSidebar },
  navbar: { Navigation: StudioAppBar },
} satisfies Partial<Record<'sidebar' | 'navbar', ShellLayout>>;

/** AppShell owns the stable content area; overrides customize only surrounding UI. */
export function Application({
  children,
  brand,
  account,
  search,
}: {
  children: ReactNode;
  brand: ReactNode;
  account: ReactNode;
  search: ReactNode;
}) {
  return (
    <AppShell
      layouts={layouts}
      brand={brand}
      account={account}
      header={search}
      groups={['navigation']}
    >
      {children}
    </AppShell>
  );
}

// Omitting layouts uses both standard arrangements.
// Supplying only sidebar or navbar leaves the other variant unchanged.
// App Preferences remains the owner of the selected sidebar/navbar value.
// Each override has a Navigation component and optional content-area Header.
// Arbitrary content wrappers are intentionally excluded to preserve mounted page state.
