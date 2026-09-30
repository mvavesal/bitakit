'use client';
import type { ElementType } from 'react';
import { ActionBinding } from './action-binding.js';
import type { ActionId } from '@bitakit/core';
export function ActionCheckbox({
  action,
  as: Component,
  onError,
  ...props
}: {
  action: ActionId;
  as?: ElementType;
  onError?: (error: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <ActionBinding action={action} kind="toggle" onError={onError}>
      {(binding) =>
        Component ? (
          <Component
            {...props}
            checked={binding.checked}
            disabled={binding.disabled}
            aria-label={binding.title}
            onCheckedChange={(value: boolean) => void binding.execute(value)}
          />
        ) : (
          <label>
            <input
              {...props}
              type="checkbox"
              checked={binding.checked}
              disabled={binding.disabled}
              onChange={(event) => void binding.execute(event.target.checked)}
            />
            {binding.title}
          </label>
        )
      }
    </ActionBinding>
  );
}
