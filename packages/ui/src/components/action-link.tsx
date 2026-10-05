'use client';
import type { ElementType, ComponentProps, ReactNode } from 'react';
import type { ActionInput } from '@bitakit/core';
import type { ActionTarget } from '../hooks/use-action.js';
import { Action } from './action.js';

/** Sugar over `<Action kind="link">`: an anchor bound to a navigation action. */
export function ActionLink<const Id extends string, C extends ElementType = 'a'>({
  action,
  input,
  as,
  children,
  ...props
}: Omit<ComponentProps<C>, 'href' | 'children'> & {
  action: ActionTarget<Id>;
  input?: ActionInput<NoInfer<Id>>;
  as?: C;
  children?: ReactNode;
}) {
  const Component = (as ?? 'a') as ElementType;
  return (
    <Action id={action} input={input} kind="link">
      <Component {...props}>{children}</Component>
    </Action>
  );
}
