import type { SettingPresentation, SettingType, SettingValue, SettingsScope } from '../types.js';
import { validateSync, type StandardSchemaV1 } from '../schema.js';
export type SettingOptions<T extends SettingValue> = {
  key: string;
  /** Text shown when no translation applies. */
  title: string;
  /** Optional translation key resolved through the host's i18n integration. */
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  scope?: SettingsScope;
  defaultValue: T;
  environmentDefault?: string;
  visible?: boolean;
  /** Legacy boolean check; prefer `schema`. */
  validate?: (value: T) => boolean;
  /** Any Standard Schema validator, for example Zod, Valibot or ArkType. */
  schema?: StandardSchemaV1<unknown, T>;
  presentation?: SettingPresentation;
  /** Set by defineSettings; the owning collection's stable ID. */
  collection?: string;
};
/** A rejected value. `issue` is the validator's user-facing message, when it provided one. */
export class SettingValidationError extends Error {
  override name = 'SettingValidationError';
  constructor(
    readonly key: string,
    readonly issue?: string,
  ) {
    super(issue ? `Invalid value for ${key}: ${issue}` : `Invalid value for ${key}.`);
  }
}
/** Defines a typed preference and its validation; stored values belong to AppPreferences. */
export class Setting<T extends SettingValue = SettingValue> {
  readonly kind: string = 'text';
  readonly type: SettingType = 'text';
  readonly key: string;
  readonly title: string;
  readonly titleKey?: string;
  readonly description?: string;
  readonly descriptionKey?: string;
  readonly scope: SettingsScope;
  readonly defaultValue: T;
  readonly environmentDefault?: string;
  readonly visible: boolean;
  readonly presentation: SettingPresentation;
  readonly collection?: string;
  private validateValue?: (value: T) => boolean;
  private schema?: StandardSchemaV1<unknown, T>;
  constructor(options: SettingOptions<T>) {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/i.test(options.key))
      throw new Error('Use a namespaced setting key.');
    this.key = options.key;
    this.title = options.title;
    this.titleKey = options.titleKey;
    this.description = options.description;
    this.descriptionKey = options.descriptionKey;
    this.scope = options.scope ?? 'user';
    this.defaultValue = options.defaultValue;
    this.environmentDefault = options.environmentDefault;
    this.visible = options.visible ?? true;
    this.presentation = Object.freeze({ ...options.presentation });
    this.collection = options.collection;
    this.validateValue = options.validate;
    this.schema = options.schema;
  }
  parse(value: unknown): T {
    if (
      typeof value !== typeof this.defaultValue ||
      Array.isArray(value) !== Array.isArray(this.defaultValue) ||
      (typeof value === 'number' && !Number.isFinite(value)) ||
      (this.validateValue && !this.validateValue(value as T))
    )
      throw new SettingValidationError(this.key);
    if (!this.schema) return value as T;
    const result = validateSync(this.schema, value);
    if (result.issues) throw new SettingValidationError(this.key, result.issues[0]?.message);
    if (typeof result.value !== typeof this.defaultValue)
      throw new Error(`Schema for ${this.key} must keep the value type.`);
    return result.value;
  }
  fromEnvironment(raw: string): T {
    const value = Array.isArray(this.defaultValue)
      ? JSON.parse(raw)
      : typeof this.defaultValue === 'boolean'
        ? raw === 'true'
          ? true
          : raw === 'false'
            ? false
            : raw
        : typeof this.defaultValue === 'number'
          ? raw.trim()
            ? Number(raw)
            : raw
          : raw;
    return this.parse(value);
  }
}
