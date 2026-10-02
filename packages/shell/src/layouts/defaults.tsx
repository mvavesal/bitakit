'use client';
import { useTranslation } from '@bitakit/ui';
import type { ComponentType, ReactNode } from 'react';
import {
  AppBar,
  ActionSidebarNavigation,
  ActionNavigationMenu,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  type ActionNavigationProps,
} from '@bitakit/ui/components';

export type ShellLayoutProps = ActionNavigationProps & {
  brand?: ReactNode;
  account?: ReactNode;
  header?: ReactNode;
};

/** Replace surrounding UI without owning or remounting the application content. */
export type ShellLayout = {
  Navigation: ComponentType<ShellLayoutProps>;
  Header?: ComponentType<ShellLayoutProps>;
};
export type ShellLayouts = Partial<Record<'sidebar' | 'navbar', ShellLayout>>;

/** Default vertical navigation, composed from standard UI primitives. */
function VerticalNavigation({ brand, account, ...navigation }: ShellLayoutProps) {
  const t = useTranslation();
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="min-h-14 justify-center">{brand}</SidebarHeader>
      <SidebarContent className="py-2">
        <nav aria-label={t('shell.ui.navigation', undefined, 'Main navigation')}>
          <ActionSidebarNavigation {...navigation} />
        </nav>
      </SidebarContent>
      <SidebarFooter>{account}</SidebarFooter>
    </Sidebar>
  );
}

/** Header above the persistent content area in vertical mode. */
function VerticalHeader({ header }: ShellLayoutProps) {
  const t = useTranslation();
  return (
    <AppBar
      className="bg-background text-foreground"
      left={
        <>
          <SidebarTrigger aria-label={t('shell.ui.toggle', undefined, 'Toggle navigation')} />
          {header}
        </>
      }
    />
  );
}

/** Default horizontal navigation; the center may be replaced through a custom layout. */
function HorizontalNavigation({ brand, account, ...navigation }: ShellLayoutProps) {
  const t = useTranslation();
  return (
    <AppBar
      left={brand}
      center={
        <nav aria-label={t('shell.ui.navigation', undefined, 'Main navigation')}>
          <ActionNavigationMenu {...navigation} />
        </nav>
      }
      right={account}
    />
  );
}

export const verticalLayout: ShellLayout = {
  Navigation: VerticalNavigation,
  Header: VerticalHeader,
};
export const horizontalLayout: ShellLayout = { Navigation: HorizontalNavigation };
