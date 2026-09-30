'use client';

import { useTranslations } from 'next-intl';
import { type ComponentProps } from 'react';
import ChevronExpandYIcon from 'reicon-react/icons/ChevronExpandY';
import { DrawerNavigation } from '@/components/navigation/drawer-navigation';
import { UserMenu } from '@/components/navigation/user-menu';
import { OrganizationSwitcher } from '@/components/organizations/organization-switcher';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

// Sidebar-07 composition with the application's real organizations and actions.
export function AppSidebar({
  email,
  name,
  image,
  ...props
}: ComponentProps<typeof Sidebar> & {
  email: string;
  name?: string;
  image?: string | null;
}) {
  const t = useTranslations('Nav');
  const { isMobile } = useSidebar();
  const displayName = name || email.split('@')[0];
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="min-h-14 justify-center">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent className="py-2">
        <DrawerNavigation />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu
              email={email}
              side={isMobile ? 'bottom' : 'right'}
              trigger={
                <SidebarMenuButton size="lg" aria-label={t('userMenu')} tooltip={t('userMenu')}>
                  <Avatar>
                    {image && <AvatarImage src={image} alt="" />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronExpandYIcon
                    className="ml-auto opacity-0 transition-opacity group-hover/menu-button:opacity-100 group-focus-visible/menu-button:opacity-100 group-data-[state=open]/menu-button:opacity-100"
                    aria-hidden="true"
                  />
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
