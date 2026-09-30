'use client';
import {
  ActionGroupBinding,
  ActionMenuItem,
  type ActionGroup,
  type ActionGroupsViewProps,
} from '@bitakit/ui/actions';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SettingsLink } from '@/components/settings/base/settings-link';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu';

function NavigationGroups({ groups }: ActionGroupsViewProps) {
  const pathname = usePathname();
  return (
    <NavigationMenuList className="flex-wrap">
      {groups.flatMap((group) =>
        group.items.map((item) => (
          <NavigationMenuItem key={`${group.id}:${item.id}`}>
            <ActionMenuItem
              binding={item}
              Link={SettingsLink}
              as={item.href !== undefined ? NavigationMenuLink : Button}
              activation="click"
              itemProps={
                item.href !== undefined ? { active: pathname === item.href } : { variant: 'ghost' }
              }
            />
          </NavigationMenuItem>
        )),
      )}
    </NavigationMenuList>
  );
}
export function ActionNavigationMenu<Input>({
  groups,
  context,
  label,
}: {
  groups: readonly ActionGroup<Input>[];
  context: Input;
  label: string;
}) {
  return (
    <NavigationMenu aria-label={label}>
      <ActionGroupBinding groups={groups} context={context} as={NavigationGroups} />
    </NavigationMenu>
  );
}
