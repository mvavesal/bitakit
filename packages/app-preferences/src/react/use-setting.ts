'use client';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { Setting } from '../fields/setting.js';
import type { SettingValue, SettingState } from '../types.js';
import { SettingsUIContext } from './context.js';
import { resolveSetting } from '../fields/reference.js';
import { useSettings } from './provider.js';
/** Subscribes to confirmed state and exposes writes through AppPreferences; it owns no second value store. */
export function useSetting<T extends SettingValue>(setting: Setting<T>) {
  const settings = useSettings();
  setting = resolveSetting(setting, settings);
  const initial = useContext(SettingsUIContext)?.initial;
  const pending = useMemo<SettingState<T>>(
    () => ({
      value: setting.defaultValue,
      ready: false,
      writable: false,
      visible: setting.visible,
      pending: false,
    }),
    [setting],
  );
  const subscribe = useCallback(
    (listener: () => void) => settings.subscribe(setting, listener),
    [settings, setting],
  );
  const get = useCallback(
    () =>
      initial?.settings.has(setting) && !settings.has(setting) ? pending : settings.get(setting),
    [settings, setting, initial, pending],
  );
  const state = useSyncExternalStore(subscribe, get, get);
  const setValue = useCallback((value: T) => settings.set(setting, value), [settings, setting]);
  return { ...state, disabled: !state.ready || !state.writable || state.pending, setValue };
}
export { useSettingsSections } from './provider.js';
