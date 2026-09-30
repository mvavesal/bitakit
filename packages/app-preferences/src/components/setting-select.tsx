'use client';
import type { ElementType } from 'react';
import type { SelectSetting } from '../fields/select-setting.js';
import { SettingBinding } from './setting-binding.js';
/** Connects a choice control to confirmed settings state and displays write errors. */
export function SettingSelect<T extends string>({
  setting,
  as: Component,
  onError,
}: {
  setting: SelectSetting<T>;
  as?: ElementType;
  onError?: (error: unknown) => void;
}) {
  return (
    <SettingBinding setting={setting}>
      {(binding) => {
        const onValueChange = (value: T) => {
          void binding.setValue(value).catch((error) => onError?.(error));
        };
        return (
          <>
            {Component ? (
              <Component
                value={binding.value}
                onValueChange={onValueChange}
                disabled={binding.disabled}
                pending={binding.pending}
                options={setting.options}
              />
            ) : (
              <label>
                {setting.title}
                <select
                  value={binding.value}
                  disabled={binding.disabled}
                  onChange={(event) => onValueChange(event.target.value as T)}
                >
                  {setting.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {binding.error && <p role="alert">{binding.error}</p>}
          </>
        );
      }}
    </SettingBinding>
  );
}
