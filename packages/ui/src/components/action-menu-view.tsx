'use client';
import type { ComponentType } from 'react';
import type { ActionGroupsViewProps } from './action-group-binding.js';
import { ActionMenuItem } from './action-menu-item.js';

/** Host primitives must support children, trigger asChild and the ActionMenuItem control contract. */
export type ActionMenuComponents = {
  Root: ComponentType<any>;
  Trigger: ComponentType<any>;
  Content: ComponentType<any>;
  Group: ComponentType<any>;
  Item: ComponentType<any>;
  Button: ComponentType<any>;
  Shortcut?: ComponentType<any>;
};

/** Render action groups using the host mapping; individual primitives may be overridden per menu. */
export function ActionMenuView({
  groups,
  label,
  components,
  contentProps,
  buttonProps = { variant: 'outline' },
}: ActionGroupsViewProps & {
  label: string;
  components: ActionMenuComponents;
  contentProps?: Record<string, unknown>;
  buttonProps?: Record<string, unknown>;
}) {
  const { Root, Trigger, Content, Group, Item, Button } = components;
  return (
    <Root>
      <Trigger asChild>
        <Button {...buttonProps}>{label}</Button>
      </Trigger>
      <Content {...contentProps}>
        {groups.map((group) => (
          <Group key={group.id}>
            {group.items.map((item) => (
              <ActionMenuItem
                key={item.id}
                binding={item}
                as={Item}
                Shortcut={components.Shortcut}
              />
            ))}
          </Group>
        ))}
      </Content>
    </Root>
  );
}
