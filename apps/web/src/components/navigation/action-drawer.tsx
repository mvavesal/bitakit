'use client';
import { usePathname } from 'next/navigation';
import { useActionGroups } from '@bitakit/ui';
import { SettingsLink } from '@/components/settings/base/settings-link';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

/** Renders action groups in the sidebar; the app owns the surrounding Sidebar, header and footer. */
export function ActionDrawer({
  groups,
  input,
  label,
}: {
  groups: readonly string[];
  input?: unknown;
  label: string;
}) {
  const bound = useActionGroups(groups, input);
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  return (
    <nav aria-label={label}>
      {bound.map((group) => (
        <SidebarGroup key={group.id}>
          {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = item.icon;
              const tooltip = item.tooltip ?? item.title;
              return (
                <SidebarMenuItem key={item.id}>
                  {item.href !== undefined ? (
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={tooltip}>
                      <SettingsLink {...item.linkProps({ onExecuted: close })} href={item.href}>
                        {Icon && <Icon aria-hidden="true" />}
                        <span>{item.title}</span>
                      </SettingsLink>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton {...item.props({ onExecuted: close })} tooltip={tooltip}>
                      {Icon && <Icon aria-hidden="true" />}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}
