'use client';
import { Fragment, type ReactElement, type ReactNode, type ComponentProps } from 'react';
import { useActionGroups, useActions, type BoundGroup } from '@bitakit/ui';
import { SettingsLink } from '@/components/settings/base/settings-link';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/** Bound action groups as dropdown sections; links navigate, other items execute. */
export function DropdownActionGroups({ groups }: { groups: readonly BoundGroup[] }) {
  // Display hints such as dividerBefore live on the registration snapshot, not on the bound control.
  const snapshots = useActions();
  return groups.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 && <DropdownMenuSeparator />}
      <DropdownMenuGroup>
        {group.title && <DropdownMenuLabel>{group.title}</DropdownMenuLabel>}
        {group.items.map((item, itemIndex) => {
          const Icon = item.icon;
          return (
            <Fragment key={item.id}>
              {itemIndex > 0 && snapshots[item.id]?.dividerBefore && <DropdownMenuSeparator />}
              {item.href !== undefined ? (
                <DropdownMenuItem asChild variant={item.variant} disabled={item.disabled}>
                  <SettingsLink {...item.linkProps()} href={item.href}>
                    {Icon && <Icon aria-hidden="true" />}
                    {item.title}
                  </SettingsLink>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem {...item.menuItemProps()}>
                  {Icon && <Icon aria-hidden="true" />}
                  {item.title}
                </DropdownMenuItem>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuGroup>
    </Fragment>
  ));
}

export function ActionMenu({
  groups,
  input,
  trigger,
  header,
  side,
}: {
  groups: readonly string[];
  input?: unknown;
  trigger: ReactElement;
  header?: ReactNode;
  side?: ComponentProps<typeof DropdownMenuContent>['side'];
}) {
  const bound = useActionGroups(groups, input);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side}>
        {header && (
          <>
            <DropdownMenuLabel>{header}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownActionGroups groups={bound} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
