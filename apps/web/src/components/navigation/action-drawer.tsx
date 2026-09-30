'use client';
import {
  ActionGroupBinding,
  ActionMenuItem,
  type ActionGroup,
  type ActionGroupsViewProps,
} from '@bitakit/ui/actions';
import { usePathname } from 'next/navigation';
import { SettingsLink } from '@/components/settings/base/settings-link';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

function DrawerGroups({ groups }: ActionGroupsViewProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return groups.map((group) => (
    <SidebarGroup key={group.id}>
      {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarMenuItem key={item.id}>
            <ActionMenuItem
              binding={item}
              as={SidebarMenuButton}
              Link={SettingsLink}
              activation="click"
              itemProps={{ isActive: pathname === item.href, tooltip: item.tooltip ?? item.title }}
              onExecuted={() => setOpenMobile(false)}
            />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
}
/** The app owns the surrounding Sidebar, header and footer. */
export function ActionDrawer<Input>({
  groups,
  context,
  label,
}: {
  groups: readonly ActionGroup<Input>[];
  context: Input;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ActionGroupBinding groups={groups} context={context} as={DrawerGroups} />
    </nav>
  );
}
