'use client';
import { useContext, type ReactNode } from 'react';
import { useAction } from '../hooks/use-action.js';
import { UIContext } from '../providers/action-context.js';
import type { ActionId, ActionInput, ActionReference } from '@bitakit/core';
export type Binding<Id extends string = string> = {
  title: string;
  description?: string;
  disabled: boolean;
  pending: boolean;
  checked: boolean;
  selected: boolean;
  value: unknown;
  execute: (input?: ActionInput<Id>) => Promise<void>;
};
export type BindingProps<Id extends ActionId = ActionId> = {
  action: Id | ActionReference<Id>;
  input?: ActionInput<Id>;
  kind?: 'command' | 'toggle' | 'choice';
  onError?: (error: unknown) => void;
  children: (binding: Binding<Id>) => ReactNode;
};
export function ActionBinding<Id extends ActionId>({
  action: id,
  input,
  kind = 'command',
  onError,
  children,
}: BindingProps<Id>) {
  const action = useAction(id, input);
  const defaults = useContext(UIContext);
  if (!action?.visible) return null;
  const binding: Binding<Id> = {
    title: action.title,
    description: action.description,
    disabled: !action.enabled || action.pending,
    pending: action.pending,
    checked: !!action.checked,
    value: action.value,
    selected: kind === 'choice' ? Object.is(action.value, input) : !!action.checked,
    async execute(value = input) {
      try {
        await action.execute(value);
      } catch (error) {
        (onError ?? defaults.onError)(error);
      }
    },
  };
  // Native title provides the default tooltip without imposing a UI library.
  return (
    <span title={action.tooltip ?? action.description} style={{ display: 'contents' }}>
      {children(binding)}
    </span>
  );
}
