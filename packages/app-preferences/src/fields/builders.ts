import type { SettingPresentation, SettingValue, SettingsScope } from '../types.js';
import type { StandardSchemaV1 } from '../schema.js';
import { humanize } from '../text.js';
import { Setting } from './setting.js';
import { SelectSetting, type SettingOption } from './select-setting.js';
import { ToggleSetting } from './toggle-setting.js';
import { TextSetting } from './text-setting.js';
import { MultiSelectSetting } from './multi-select-setting.js';
import { NumberSetting } from './number-setting.js';

type FieldOptions<T extends SettingValue> = {
  /** Fallback label; defaults to the humanized field name. */
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  /** Overrides the collection scope for this field. */
  scope?: SettingsScope;
  defaultValue: T;
  environmentDefault?: string;
  visible?: boolean;
  schema?: StandardSchemaV1<unknown, T>;
  presentation?: SettingPresentation;
};
type FieldContext = { key: string; name: string; collection: string; scope: SettingsScope };
/** An unbound field declaration; defineSettings turns it into a definition with a stable key. */
export type FieldSpec<S extends Setting<any> = Setting<any>> = {
  readonly bind: (context: FieldContext) => S;
};
function common<T extends SettingValue>(options: FieldOptions<T>, context: FieldContext) {
  return {
    ...options,
    key: context.key,
    title: options.title ?? humanize(context.name),
    scope: options.scope ?? context.scope,
    collection: context.collection,
  };
}
export function booleanField(options: FieldOptions<boolean>): FieldSpec<ToggleSetting> {
  return { bind: (context) => new ToggleSetting(common(options, context)) };
}
export function textField(options: FieldOptions<string>): FieldSpec<TextSetting> {
  return { bind: (context) => new TextSetting(common(options, context)) };
}
export function numberField(options: FieldOptions<number>): FieldSpec<NumberSetting> {
  return { bind: (context) => new NumberSetting(common(options, context)) };
}
type ChoiceInput = string | SettingOption;
type ChoiceValue<O> = O extends string
  ? O
  : O extends { value: infer V extends string }
    ? V
    : never;
/** Option values are inferred as a literal union; labels default to humanized values. */
export function choiceField<const O extends readonly ChoiceInput[]>(
  options: FieldOptions<ChoiceValue<O[number]>> & { options: O },
): FieldSpec<SelectSetting<ChoiceValue<O[number]>>> {
  const { options: choices, ...rest } = options;
  const normalized = choices.map((choice) =>
    typeof choice === 'string' ? { value: choice, label: humanize(choice) } : choice,
  ) as SettingOption<ChoiceValue<O[number]>>[];
  return {
    bind: (context) => new SelectSetting({ ...common(rest, context), options: normalized }),
  };
}

/** Multiple declared options, with literal option types preserved in reads and writes. */
export function multiChoiceField<const O extends readonly ChoiceInput[]>(
  options: FieldOptions<readonly ChoiceValue<O[number]>[]> & { options: O },
): FieldSpec<MultiSelectSetting<ChoiceValue<O[number]>>> {
  const { options: choices, ...rest } = options;
  const normalized = choices.map((choice) =>
    typeof choice === 'string' ? { value: choice, label: humanize(choice) } : choice,
  ) as SettingOption<ChoiceValue<O[number]>>[];
  return {
    bind: (context) => new MultiSelectSetting({ ...common(rest, context), options: normalized }),
  };
}

type BoundFields<F> = { readonly [K in keyof F]: F[K] extends FieldSpec<infer S> ? S : never };
/** A stable, React-free group of definitions. Keys are `${id}.${fieldName}`. */
export class SettingsCollection<F extends Record<string, FieldSpec> = Record<string, FieldSpec>> {
  readonly id: string;
  readonly scope: SettingsScope;
  readonly title?: string;
  readonly titleKey?: string;
  readonly description?: string;
  readonly descriptionKey?: string;
  readonly fields: BoundFields<F>;
  /** Definitions in declaration order. */
  readonly settings: readonly Setting<any>[];
  constructor(options: CollectionOptions<F>) {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(options.id))
      throw new Error(
        `Invalid settings collection ID "${options.id}". Use a stable lowercase ID such as "editor" or "billing.invoices".`,
      );
    this.id = options.id;
    this.scope = options.scope ?? 'user';
    this.title = options.title;
    this.titleKey = options.titleKey;
    this.description = options.description;
    this.descriptionKey = options.descriptionKey;
    const fields: Record<string, Setting<any>> = {};
    for (const [name, spec] of Object.entries(options.fields)) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(name))
        throw new Error(`Invalid field name "${name}" in settings collection "${this.id}".`);
      if (!spec || typeof spec.bind !== 'function')
        throw new Error(
          `Field "${name}" in settings collection "${this.id}" must use a field builder such as choiceField().`,
        );
      fields[name] = spec.bind({
        key: `${this.id}.${name}`,
        name,
        collection: this.id,
        scope: this.scope,
      });
    }
    this.fields = Object.freeze(fields) as BoundFields<F>;
    this.settings = Object.freeze(Object.values(fields));
  }
}
export type CollectionOptions<F extends Record<string, FieldSpec>> = {
  /** Durable override for the key prefix. Keep it stable when moving persisted definitions. */
  id: string;
  scope?: SettingsScope;
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  fields: F;
};
/** An ID-free declaration, resolved once discovery supplies its module and file path. */
export class SettingsDeclaration<F extends Record<string, FieldSpec>, Id extends string = string> {
  constructor(readonly options: Omit<CollectionOptions<F>, 'id'> & { id?: Id }) {}
  resolve(inferredId: string): SettingsCollection<F> {
    return new SettingsCollection({ ...this.options, id: this.options.id ?? inferredId });
  }
}
export function defineSettings<const F extends Record<string, FieldSpec>, const Id extends string>(
  options: CollectionOptions<F> & { id: Id },
): SettingsCollection<F> & { readonly id: Id };
export function defineSettings<const F extends Record<string, FieldSpec>>(
  options: Omit<CollectionOptions<F>, 'id'>,
): SettingsDeclaration<F, never>;
export function defineSettings(
  options: CollectionOptions<any> | Omit<CollectionOptions<any>, 'id'>,
): any {
  return 'id' in options ? new SettingsCollection(options) : new SettingsDeclaration(options);
}
/** What a registration or a section may reference. */
export type SettingsSource = SettingsCollection<any> | Setting<any>;
export function settingsOf(source: SettingsSource | readonly SettingsSource[]): Setting<any>[] {
  const list = Array.isArray(source) ? source : [source as SettingsSource];
  return list.flatMap((item) => {
    if (item instanceof SettingsCollection) return [...item.settings];
    if (item instanceof Setting) return [item];
    throw new Error('Expected a settings collection or setting definition.');
  });
}
