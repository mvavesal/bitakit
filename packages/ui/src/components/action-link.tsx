'use client';
import type { ElementType, ComponentProps, ReactNode } from 'react';
import type { ActionId, ActionReference } from '@bitakit/core';
import { Action } from './action.js';

/** Sugar over `<Action kind="link">`: an anchor bound to a navigation action. */
export function ActionLink<Id extends ActionId, C extends ElementType = 'a'>({
  action,
  as,
  children,
  ...props
}: Omit<ComponentProps<C>, 'href' | 'children'> & {
  action: Id | ActionReference<Id>;
  as?: C;
  children?: ReactNode;
}) {
  const Component = (as ?? 'a') as ElementType;
  return (
    <Action id={action} kind="link">
      <Component {...props}>{children}</Component>
    </Action>
  );
}
