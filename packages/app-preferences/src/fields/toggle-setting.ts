import { Setting } from './setting.js';
/** Defines a boolean preference; rendering and persistence are supplied separately. */
export class ToggleSetting extends Setting<boolean> {
  readonly kind = 'toggle';
  readonly type = 'boolean';
}
