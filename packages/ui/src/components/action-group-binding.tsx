'use client';
import type { ComponentType } from 'react';
import { useActions, useActionList } from '../hooks/use-action.js';
import { bindAction, type BoundAction } from '../bindings/bound-action.js';
import type { ActionGroup } from '@bitakit/core';

export type BoundActionGroup = { id: string; title?: string; items: readonly BoundAction[] };
export type ActionGroupsViewProps = { groups: readonly BoundActionGroup[] };
export type ActionGroupBindingProps<Input> = {
  groups: readonly ActionGroup<Input>[];
  context: Input;
  as: ComponentType<ActionGroupsViewProps>;
};
/** One live subscription surface, shared by menus, navigation and custom renderers. */
export function ActionGroupBinding<Input>({
  groups,
  context,
  as: View,
}: ActionGroupBindingProps<Input>) {
  const snapshots = useActions();
  const list = useActionList();
  const projected = groups
    .map((group) => ({
      id: group.id,
      title: group.title,
      items: Object.values(snapshots)
        .filter(
          (action) =>
            !action.internal && action.groups?.some((placement) => placement.id === group.id),
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
        .flatMap((action) => {
          const current = list.resolve(action.id, context);
          return current?.visible ? [bindAction(list, current, context)] : [];
        }),
    }))
    .filter((group) => group.items.length);
  return <View groups={projected} />;
}
