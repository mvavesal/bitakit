import type { InputSchema, SchemaOutput } from '../definitions.js';
import type { PresentationType } from '../presentation.js';
import { validateSync } from '../schema.js';

/** Who a value belongs to: the signed-in user, the active organization, or this browser. */
export type SettingScope = 'user' | 'organization' | 'device';
export type SettingControl =
  | 'switch'
  | 'select'
  | 'radio'
  | 'cards'
  | 'text'
  | 'textarea'
  | 'number';
export type SettingOption<T = unknown> = {
  readonly value: T;
  readonly label?: string;
  readonly description?: string;
  readonly icon?: PresentationType<'icon'>;
};
declare const settingType: unique symbol;
/** One declared setting. Values are read and written through `settings.<plugin>.<name>`. */
export type SettingSpec<T = unknown> = {
  readonly kind: 'setting';
  readonly default: T;
  /** zod, valibot or any Standard Schema that validates synchronously. */
  readonly schema?: InputSchema<T>;
  readonly scope: SettingScope;
  readonly label?: string;
  readonly description?: string;
  /** Presentation hint for generated settings pages; inferred from the value when omitted. */
  readonly control?: SettingControl;
  readonly options?: readonly SettingOption<T>[];
  readonly order?: number;
  readonly group?: string;
  /** Readable and writable, but left out of generated settings pages. */
  readonly hidden?: boolean;
  readonly [settingType]?: T;
};
type SettingInput<T> = {
  default: T;
  schema?: InputSchema<T>;
  scope?: SettingScope;
  label?: string;
  description?: string;
  control?: SettingControl;
  options?: readonly SettingOption<T>[];
  order?: number;
  group?: string;
  hidden?: boolean;
};
const scopes: readonly SettingScope[] = ['user', 'organization', 'device'];
const controls: readonly SettingControl[] = [
  'switch',
  'select',
  'radio',
  'cards',
  'text',
  'textarea',
  'number',
];

/** `setting({ schema: z.number().min(1), default: 20 })`: the type follows the schema. */
export function setting<S extends InputSchema<any>>(
  spec: Omit<SettingInput<SchemaOutput<S>>, 'schema'> & { schema: S },
): SettingSpec<SchemaOutput<S>>;
/** `setting({ default: 'system', options: [{ value: 'light' }, ...] })`: the type is the option union. */
export function setting<const O extends readonly SettingOption<any>[]>(
  spec: Omit<SettingInput<O[number]['value']>, 'schema' | 'options'> & {
    schema?: undefined;
    options: O;
  },
): SettingSpec<O[number]['value']>;
/** `setting({ default: true })`: the type follows the default. */
export function setting<T>(
  spec: SettingInput<T> & { schema?: undefined; options?: undefined },
): SettingSpec<T>;
export function setting(spec: SettingInput<unknown>): SettingSpec<unknown> {
  if (!spec || typeof spec !== 'object' || !('default' in spec))
    throw new Error('setting() needs a default value, for example setting({ default: true }).');
  const scope = spec.scope ?? 'user';
  if (!scopes.includes(scope))
    throw new Error(`Invalid setting scope "${scope}". Use "user", "organization" or "device".`);
  if (spec.control !== undefined && !controls.includes(spec.control))
    throw new Error(
      `Invalid setting control "${spec.control}". Use one of ${controls.join(', ')}.`,
    );
  return Object.freeze({ ...spec, kind: 'setting' as const, scope });
}
export function isSettingSpec(value: unknown): value is SettingSpec {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'setting';
}

/** Optional presentation of the generated settings section of one plugin. */
export type SettingsSectionOptions = {
  title?: string;
  description?: string;
  icon?: PresentationType<'icon'>;
  /** URL segment of the generated page; defaults to the plugin ID (`general` for the app). */
  path?: string;
  /** Keyboard shortcut of the navigation action that opens the page, for example `Alt+Shift+O`. */
  shortcut?: string;
  /** Groups sections in navigation, for example `appearance` or `account`. */
  category?: string;
  order?: number;
};
export type SettingsDefinition<
  Specs extends Record<string, SettingSpec<any>> = Record<string, SettingSpec<any>>,
> = {
  readonly kind: 'settings';
  readonly settings: Specs;
  readonly section?: SettingsSectionOptions;
};
/**
 * Declares a plugin's settings in `settings.ts`. Keys are prefixed with the plugin ID, so
 * `pageSize` in plugin `todos` is `todos.pageSize` (app settings keep their plain name). Values
 * are owned by the runtime and persisted through the `settings.storage` contract.
 */
export function defineSettings<const Specs extends Record<string, SettingSpec<any>>>(
  settings: Specs,
  section?: SettingsSectionOptions,
): SettingsDefinition<Specs> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings))
    throw new Error('defineSettings expects a record: defineSettings({ name: setting({ ... }) }).');
  for (const [name, spec] of Object.entries(settings)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name))
      throw new Error(
        `Invalid setting name "${name}". Use letters, digits, "_" or "-" without dots.`,
      );
    if (!isSettingSpec(spec))
      throw new Error(`Setting "${name}" must be declared with setting({ default, ... }).`);
    try {
      parseSetting(spec, spec.default, name);
    } catch (error) {
      throw new Error(
        `The default of setting "${name}" is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (section?.path !== undefined && !/^[a-z][a-z0-9-]*$/.test(section.path))
    throw new Error(
      `Invalid settings section path "${section.path}". Use lowercase letters, digits and hyphens.`,
    );
  if (section?.category !== undefined && !/^[a-z][a-z0-9-]*$/.test(section.category))
    throw new Error(
      `Invalid settings category "${section.category}". Use lowercase letters, digits and hyphens.`,
    );
  return Object.freeze({ kind: 'settings', settings, section });
}
export function isSettingsDefinition(value: unknown): value is SettingsDefinition {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'settings';
}

const show = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};
/** Validates a value against its declaration: the schema, then the option list, then the default's type. */
export function parseSetting<T>(spec: SettingSpec<T>, value: unknown, key = 'setting'): T {
  if (spec.schema) {
    const checked = validateSync(spec.schema, value);
    if (!checked)
      throw new Error(
        `Setting "${key}" uses a schema that validates asynchronously; settings schemas must be synchronous.`,
      );
    if (!checked.ok) throw checked.error;
    return checked.value;
  }
  if (spec.options) {
    if (!spec.options.some((option) => Object.is(option.value, value)))
      throw new Error(
        `Setting "${key}" accepts ${spec.options.map((option) => show(option.value)).join(', ')}; got ${show(value)}.`,
      );
    return value as T;
  }
  const expected = typeof spec.default;
  if (spec.default !== null && spec.default !== undefined && typeof value !== expected)
    throw new Error(
      `Setting "${key}" expects a ${expected}; got ${value === null ? 'null' : typeof value}.`,
    );
  if (expected === 'number' && !Number.isFinite(value))
    throw new Error(`Setting "${key}" expects a finite number; got ${String(value)}.`);
  return value as T;
}

// ---------------------------------------------------------------------------------------------
// Types for generated declarations
// ---------------------------------------------------------------------------------------------

/** Setting keys and value types. Generated from every `settings.ts`; may also be augmented by hand. */
export interface SettingsMap {}
export type SettingKey = Extract<keyof SettingsMap, string> | (string & {});
export type SettingValue<Key extends string> = Key extends keyof SettingsMap
  ? SettingsMap[Key]
  : unknown;
type ValueOf<S> = S extends SettingSpec<infer T> ? T : never;
/** `SettingsMap` entries of one declaration under a plugin prefix (none for the app module). */
export type SettingsOf<D, Plugin extends string> =
  D extends SettingsDefinition<infer Specs>
    ? {
        [K in keyof Specs & string as Plugin extends '' ? K : `${Plugin}.${K}`]: ValueOf<Specs[K]>;
      }
    : {};
