'use client';
import type { ElementType } from 'react';
import type { ToggleSetting } from '../fields/toggle-setting.js';
import { SettingBinding } from './setting-binding.js';
/** Saves boolean changes through SettingBinding using a supplied control or a native checkbox. */
export function SettingToggle({
  setting,
  as: Component,
}: {
  setting: ToggleSetting;
  as?: ElementType;
}) {
  return (
    <SettingBinding setting={setting}>
      {(binding) => {
        const change = (checked: boolean) => {
          void binding.setValue(checked).catch(() => {});
        };
        return (
          <label>
            {setting.title}
            {Component ? (
              <Component
                checked={binding.value}
                disabled={binding.disabled}
                onCheckedChange={change}
              />
            ) : (
              <input
                type="checkbox"
                checked={binding.value}
                disabled={binding.disabled}
                onChange={(e) => change(e.target.checked)}
              />
            )}
            {binding.error && <span role="alert">{binding.error}</span>}
          </label>
        );
      }}
    </SettingBinding>
  );
}
