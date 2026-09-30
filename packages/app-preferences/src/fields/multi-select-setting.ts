import { z } from 'zod';
import { Setting, type SettingOptions } from './setting.js';
import type { SettingOption } from './select-setting.js';

/** A set of declared choices. Arrays are validated and frozen before entering confirmed state. */
export class MultiSelectSetting<T extends string = string> extends Setting<readonly T[]> {
  readonly kind = 'multi-select';
  readonly type = 'multi-choice';
  readonly options: readonly SettingOption<T>[];
  private readonly choices;

  constructor(options: SettingOptions<readonly T[]> & { options: readonly SettingOption<T>[] }) {
    super({ ...options, defaultValue: Object.freeze([...options.defaultValue]) });
    this.options = Object.freeze(options.options.map((option) => Object.freeze({ ...option })));
    this.choices = z.array(z.enum(this.options.map((option) => option.value)));
    this.parse(this.defaultValue);
  }

  override parse(value: unknown): readonly T[] {
    return Object.freeze([...new Set(this.choices.parse(super.parse(value)))]) as readonly T[];
  }
}
