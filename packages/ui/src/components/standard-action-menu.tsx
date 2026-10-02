'use client';
import type { BoundGroup } from '../hooks/use-action-group.js';
import { Button } from './primitives/button.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from './primitives/dropdown-menu.js';
import { ActionShortcutLabel } from './action-shortcut-label.js';

/** Standard menu presentation of bound action groups, using the host theme tokens. */
export function StandardActionMenu({
  groups,
  label,
}: {
  groups: readonly BoundGroup[];
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {groups.map((group) => (
          <DropdownMenuGroup key={group.id}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const props = item.href !== undefined ? item.linkProps() : item.menuItemProps();
              return (
                <DropdownMenuItem
                  key={item.id}
                  asChild={item.href !== undefined}
                  {...(item.href !== undefined ? { disabled: item.disabled } : props)}
                >
                  {item.href !== undefined ? (
                    <a {...props}>
                      {Icon && <Icon aria-hidden="true" />}
                      {item.title}
                    </a>
                  ) : (
                    <>
                      {Icon && <Icon aria-hidden="true" />}
                      {item.title}
                      {item.shortcut && (
                        <DropdownMenuShortcut>
                          <ActionShortcutLabel keys={item.shortcut.keys} />
                        </DropdownMenuShortcut>
                      )}
                    </>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
