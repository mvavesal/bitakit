'use client';
import type { ComponentProps } from 'react';
import { Input } from '@bitakit/ui/components';

type TextFieldProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value?: unknown;
  onValueChange?: (value: string) => void;
};

/**
 * A text input with `value` and `onValueChange`, the props `<Action kind="choice">` passes:
 * bound to an Action, it shows the Action's `value` and runs it on every keystroke. An input
 * has no content, so the icon and title the binding offers as children are left out.
 */
export function TextField({ value, onValueChange, children: _content, ...props }: TextFieldProps) {
  return (
    <Input
      {...props}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  );
}
