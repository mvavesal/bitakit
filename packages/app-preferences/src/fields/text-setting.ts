import { Setting } from './setting.js';
/** Defines a string preference using the shared validation contract. */
export class TextSetting extends Setting<string> {
  readonly kind = 'text';
  readonly type = 'text';
}
