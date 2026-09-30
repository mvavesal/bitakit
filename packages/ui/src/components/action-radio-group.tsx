'use client';
import { useId, type ElementType } from 'react';
import { ActionBinding } from './action-binding.js';
import type { ActionId } from '@bitakit/core';
export type ActionOption = { value: string; label: string };
export function ActionRadioGroup({
  action,
  as: Component,
  options,
  onError,
  ...props
}: {
  action: ActionId;
  as?: ElementType;
  options: readonly ActionOption[];
  onError?: (error: unknown) => void;
  [key: string]: unknown;
}) {
  const name = useId();
  return (
    <ActionBinding action={action} kind="choice" onError={onError}>
      {(binding) =>
        Component ? (
          <Component
            {...props}
            value={binding.value}
            disabled={binding.disabled}
            options={options}
            onValueChange={(value: string) => void binding.execute(value)}
          />
        ) : (
          <fieldset {...props} disabled={binding.disabled}>
            <legend>{binding.title}</legend>
            {options.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={binding.value === option.value}
                  onChange={() => void binding.execute(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        )
      }
    </ActionBinding>
  );
}
