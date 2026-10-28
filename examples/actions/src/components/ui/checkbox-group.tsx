'use client';
import { useId } from 'react';
import { Checkbox, Field, FieldLabel } from '@bitakit/ui/components';

type CheckboxGroupProps = {
  options: readonly { value: string; label: string }[];
  value?: unknown;
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  'aria-label'?: string;
};

/**
 * Several checkboxes with one `value` (the checked values) and `onValueChange`, the props
 * `<Action kind="choice">` passes: bound to an Action, it runs with the new list on each tick.
 */
export function CheckboxGroup({
  options,
  value,
  onValueChange,
  disabled,
  ...props
}: CheckboxGroupProps) {
  const id = useId();
  const checked = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div role="group" aria-label={props['aria-label']} className="flex flex-wrap gap-6">
      {options.map((option) => (
        <Field key={option.value} orientation="horizontal" className="w-auto">
          <Checkbox
            id={`${id}-${option.value}`}
            disabled={disabled}
            checked={checked.includes(option.value)}
            onCheckedChange={(on) =>
              onValueChange?.(
                on ? [...checked, option.value] : checked.filter((item) => item !== option.value),
              )
            }
          />
          <FieldLabel htmlFor={`${id}-${option.value}`} className="font-normal">
            {option.label}
          </FieldLabel>
        </Field>
      ))}
    </div>
  );
}
