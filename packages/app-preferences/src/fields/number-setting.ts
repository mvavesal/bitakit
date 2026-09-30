import { Setting } from './setting.js';
/** Defines a finite numeric preference using the shared validation contract. */
export class NumberSetting extends Setting<number> {
  readonly kind = 'number';
  readonly type = 'number';
}
