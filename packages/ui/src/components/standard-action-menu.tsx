'use client';
import { ActionMenuView } from './action-menu-view.js';
import type { ActionGroupsViewProps } from './action-group-binding.js';
import { Button } from './primitives/button.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from './primitives/dropdown-menu.js';

const components = {
  Root: DropdownMenu,
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Group: DropdownMenuGroup,
  Item: DropdownMenuItem,
  Button,
  Shortcut: DropdownMenuShortcut,
};

/** Standard menu presentation using the shared Foundation action bindings and host theme tokens. */
export function StandardActionMenu(props: ActionGroupsViewProps & { label: string }) {
  return <ActionMenuView {...props} components={components} />;
}
