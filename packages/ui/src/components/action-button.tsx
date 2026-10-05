'use client';
import type { ElementType, ComponentProps, ReactNode } from 'react';
import type { ActionId, ActionInput, ExecutionResult } from '@bitakit/core';
import type { ActionTarget } from '../hooks/use-action.js';
import { Action } from './action.js';

export type ActionButtonProps<
  Id extends string = ActionId,
  C extends ElementType = 'button',
> = Omit<ComponentProps<C>, 'onClick' | 'children'> & {
  action: ActionTarget<Id>;
  input?: ActionInput<NoInfer<Id>>;
  /** The component to render; defaults to a native button. */
  as?: C;
  onError?: (error: unknown) => void;
  onExecuted?: (result: ExecutionResult) => void;
  pending?: ReactNode;
  children?: ReactNode;
};

/** Sugar over `<Action>`: a button bound to an action, rendered as `as` or a native button. */
export function ActionButton<const Id extends string, C extends ElementType = 'button'>({
  action,
  input,
  as,
  onError,
  onExecuted,
  pending,
  children,
  ...props
}: ActionButtonProps<Id, C>) {
  const Component = (as ?? 'button') as ElementType;
  return (
    <Action
      id={action}
      input={input}
      kind="button"
      onError={onError}
      onExecuted={onExecuted}
      pending={pending}
    >
      <Component {...props}>{children}</Component>
    </Action>
  );
}
