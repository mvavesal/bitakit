'use client';
import type { ReactNode } from 'react';
import type { Setting } from '../fields/setting.js';
import type { SettingValue } from '../types.js';
import { useSetting } from '../react/use-setting.js';
/** Passes live setting state to a host render function; hidden settings render nothing. */
export function SettingBinding<T extends SettingValue>({
  setting,
  children,
}: {
  setting: Setting<T>;
  children: (binding: ReturnType<typeof useSetting<T>>) => ReactNode;
}) {
  const binding = useSetting(setting);
  return binding.visible ? children(binding) : null;
}
