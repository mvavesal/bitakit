'use client';
import { useState } from 'react';
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

/**
 * Standard menu presentation of bound action groups, using the host theme tokens. Navigation
 * Actions render as real links; a link routes on the client and cancels its click, so Radix does
 * not see a selection and the menu closes itself once the link ran.
 */
export function StandardActionMenu({
  groups,
  label,
}: {
  groups: readonly BoundGroup[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {groups.map((group) => (
          <DropdownMenuGroup key={group.id}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const props =
                item.href !== undefined
                  ? item.linkProps({ onExecuted: () => setOpen(false) })
                  : item.menuItemProps();
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
