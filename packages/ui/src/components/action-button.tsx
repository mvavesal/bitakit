'use client';
import type { ElementType, ComponentPropsWithoutRef } from 'react';
import { useAction } from '../hooks/use-action.js';
import { ActionBinding } from './action-binding.js';
import type { ActionId, ActionInput, ActionReference } from '@bitakit/core';
export type ActionButtonProps<Id extends ActionId = ActionId> = Omit<
  ComponentPropsWithoutRef<'button'>,
  'onClick'
> & {
  action: Id | ActionReference<Id>;
  input?: ActionInput<Id>;
  as?: ElementType;
  onError?: (error: unknown) => void;
  [key: string]: unknown;
};
export function ActionButton<Id extends ActionId>({
  action,
  input,
  as: Component = 'button',
  onError,
  children,
  ...props
}: ActionButtonProps<Id>) {
  const state = useAction(action);
  const Icon = state?.icon;
  return (
    <ActionBinding action={action} input={input} onError={onError}>
      {(binding) => (
        <Component
          {...props}
          type="button"
          disabled={binding.disabled || props.disabled}
          aria-busy={binding.pending}
          aria-pressed={state?.checked}
          title={binding.description}
          onClick={() => void binding.execute()}
        >
          {Icon && <Icon aria-hidden="true" />}
          {children ?? (binding.pending ? 'Working…' : binding.title)}
        </Component>
      )}
    </ActionBinding>
  );
}
