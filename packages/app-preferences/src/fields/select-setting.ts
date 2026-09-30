import { Setting, type SettingOptions } from './setting.js';
export type SettingOption<T extends string = string> = Readonly<{
  value: T;
  label: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
}>;
/** Restricts a string preference to its declared options, including its default. */
export class SelectSetting<T extends string = string> extends Setting<T> {
  readonly kind = 'select';
  readonly type = 'choice';
  readonly options: readonly SettingOption<T>[];
  constructor(options: SettingOptions<T> & { options: readonly SettingOption<T>[] }) {
    super(options);
    this.options = Object.freeze(options.options.map((option) => Object.freeze({ ...option })));
    this.parse(options.defaultValue);
  }
  parse(value: unknown): T {
    const parsed = super.parse(value);
    if (!this.options.some((option) => option.value === parsed))
      throw new Error(`Invalid option for ${this.key}.`);
    return parsed;
  }
}
