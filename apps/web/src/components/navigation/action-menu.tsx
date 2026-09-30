'use client';
import { Fragment, type ReactElement, type ReactNode, type ComponentProps } from 'react';
import {
  ActionGroupBinding,
  ActionMenuItem,
  type ActionGroup,
  type ActionGroupsViewProps,
} from '@bitakit/ui/actions';
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

export function DropdownActionGroups({ groups }: ActionGroupsViewProps) {
  return groups.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 && <DropdownMenuSeparator />}
      <DropdownMenuGroup>
        {group.title && <DropdownMenuLabel>{group.title}</DropdownMenuLabel>}
        {group.items.map((item, itemIndex) => (
          <Fragment key={item.id}>
            {itemIndex > 0 && item.dividerBefore && <DropdownMenuSeparator />}
            <ActionMenuItem binding={item} as={DropdownMenuItem} Link={SettingsLink} />
          </Fragment>
        ))}
      </DropdownMenuGroup>
    </Fragment>
  ));
}
export function ActionMenu<Input>({
  groups,
  context,
  trigger,
  header,
  side,
}: {
  groups: readonly ActionGroup<Input>[];
  context: Input;
  trigger: ReactElement;
  header?: ReactNode;
  side?: ComponentProps<typeof DropdownMenuContent>['side'];
}) {
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
        <ActionGroupBinding groups={groups} context={context} as={DropdownActionGroups} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
