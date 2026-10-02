'use client';
import { useContext, useMemo } from 'react';
import type { ActionGroup } from '@bitakit/core';
import { UIContext } from '../providers/action-context.js';
import { buildControl, useActionList, useActions, type ActionControl } from './use-action.js';
import { useGroupTitle } from './use-group-title.js';
import { FoundationContext } from '../providers/foundation-context.js';

export type BoundGroup = { id: string; title: string; items: readonly ActionControl[] };

/** The current, visible members of action groups, ordered, with controls bound to `input`. */
export function useActionGroups(
  groups: readonly (string | ActionGroup)[],
  input?: unknown,
): readonly BoundGroup[] {
  const list = useActionList();
  const ui = useContext(UIContext);
  const snapshots = useActions();
  const groupTitle = useGroupTitle();
  const runtime = useContext(FoundationContext)?.runtime;
  const key = groups.map((group) => (typeof group === 'string' ? group : group.id)).join('\u0000');
  return useMemo(
    () =>
      groups
        .map((group) => {
          const id = typeof group === 'string' ? group : group.id;
          const title = typeof group === 'string' ? undefined : group.title;
          const items = Object.values(snapshots)
            .filter(
              (action) =>
                !action.internal && action.groups?.some((placement) => placement.id === id),
            )
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
            .flatMap((action) => {
              const current = list.resolve(action.id, input);
              return current?.visible ? [buildControl(list, current, input, ui)] : [];
            });
          return {
            id,
            title: groupTitle({ id, title: title ?? runtime?.groups.get(id)?.title }),
            items,
          };
        })
        .filter((group) => group.items.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, snapshots, list, input, ui, groupTitle, runtime],
  );
}
/** One group; an empty result has no items. */
export function useActionGroup(group: string | ActionGroup, input?: unknown): BoundGroup {
  const [bound] = useActionGroups([group], input);
  const groupTitle = useGroupTitle();
  const id = typeof group === 'string' ? group : group.id;
  return (
    bound ?? {
      id,
      title: groupTitle({ id, title: typeof group === 'string' ? undefined : group.title }),
      items: [],
    }
  );
}
