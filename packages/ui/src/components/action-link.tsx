'use client';
import type { ElementType, ComponentProps, ReactNode } from 'react';
import type { ActionId, ActionInput, ExecutionResult } from '@bitakit/core';
import type { ActionTarget } from '../hooks/use-action.js';
import { Action } from './action.js';

/**
 * `action` names the target so `id` stays the rendered element's HTML attribute, as in
 * `ActionButton`; only the generic `<Action id>` takes the target as `id`.
 */
export type ActionLinkProps<Id extends string = ActionId, C extends ElementType = 'a'> = Omit<
  ComponentProps<C>,
  'href' | 'children'
> & {
  action: ActionTarget<Id>;
  input?: ActionInput<NoInfer<Id>>;
  /** The component to render; defaults to a native anchor. */
  as?: C;
  onError?: (error: unknown) => void;
  onExecuted?: (result: ExecutionResult) => void;
  pending?: ReactNode;
  children?: ReactNode;
};

/** Sugar over `<Action kind="link">`: an anchor bound to a navigation action. */
export function ActionLink<const Id extends string, C extends ElementType = 'a'>({
  action,
  input,
  as,
  onError,
  onExecuted,
  pending,
  children,
  ...props
}: ActionLinkProps<Id, C>) {
  const Component = (as ?? 'a') as ElementType;
  return (
    <Action
      id={action}
      input={input}
      kind="link"
      onError={onError}
      onExecuted={onExecuted}
      pending={pending}
    >
      <Component {...props}>{children}</Component>
    </Action>
  );
}
