export type SettingValue = string | number | boolean | readonly string[];
export type SettingsScope = 'user' | 'organization' | 'global';
export type SettingsContext = Readonly<{ userId?: string; organizationId?: string }>;
/** Value family used for renderer resolution; independent of the concrete definition class. */
export type SettingType = 'boolean' | 'choice' | 'multi-choice' | 'text' | 'number';
export type SettingState<T extends SettingValue> = Readonly<{
  value: T;
  ready: boolean;
  writable: boolean;
  visible: boolean;
  pending: boolean;
  error?: string;
}>;
export type StoredSetting = { value?: SettingValue; writable: boolean };
/**
 * Replaceable persistence boundary. `load` and `save` are required; the optional operations
 * let adapters batch initial loading and remove a stored override on reset.
 */
export interface SettingsStorage {
  load(key: string, context: SettingsContext): Promise<StoredSetting>;
  save(key: string, value: SettingValue, context: SettingsContext): Promise<void>;
  /** One request for many keys. Every requested key should be present in the result. */
  loadMany?(
    keys: readonly string[],
    context: SettingsContext,
  ): Promise<Readonly<Record<string, StoredSetting>>>;
  /** Removes the stored override and returns the resolved value that now applies. */
  reset?(key: string, context: SettingsContext): Promise<StoredSetting>;
}
/**
 * Outcome of a write that did not fail:
 * - `saved`: the write carrying this value was confirmed in the current context.
 * - `superseded`: a newer value replaced this one; resolves once the key settles.
 * - `cancelled`: the context changed or the setting was removed before confirmation.
 * A write rejects only when the write carrying its own value failed.
 */
export type SaveResult = 'saved' | 'superseded' | 'cancelled';
export type Registration = { remove(): void };
/** A literal string, or a translation key with the text shown when no translation exists. */
export type LocalizedText = string | Readonly<{ key: string; fallback: string }>;
/** Plain display hints. They never change storage, validation or authorization. */
export type SettingPresentation = Readonly<{
  order?: number;
  variant?: string;
  columns?: number;
  orientation?: 'horizontal' | 'vertical';
  min?: number;
  max?: number;
  step?: number;
}>;
