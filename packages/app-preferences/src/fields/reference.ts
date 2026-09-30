import type { AppPreferences } from '../app-preferences.js';
import type { Setting } from './setting.js';
import type { SettingValue } from '../types.js';

/** A definition-compatible handle; reads and writes always use its owning preferences service. */
export type SettingReference<S extends Setting<any>> = S & {
  get(): S extends Setting<infer V> ? V : never;
  set(value: S extends Setting<infer V> ? V : never): ReturnType<AppPreferences['set']>;
};
const references = new WeakMap<object, { setting: Setting<any>; owner: () => AppPreferences }>();
export function createSettingReference<S extends Setting<any>>(
  setting: S,
  owner: () => AppPreferences,
): SettingReference<S> {
  const reference = new Proxy(setting, {
    get(target, key, receiver) {
      if (key === 'get') return () => owner().get(target).value;
      if (key === 'set') return (value: SettingValue) => owner().set(target, value);
      return Reflect.get(target, key, receiver);
    },
  }) as SettingReference<S>;
  references.set(reference, { setting, owner });
  return reference;
}
/** Existing UI subscriptions keep the original definition identity and provider ownership. */
export function resolveSetting<T extends SettingValue>(
  setting: Setting<T>,
  owner: AppPreferences,
): Setting<T> {
  const reference = references.get(setting);
  if (!reference) return setting;
  if (reference.owner() !== owner)
    throw new Error('Setting reference belongs to another preferences instance.');
  return reference.setting;
}
