import { Action, type ActionOptions } from '@bitakit/core/actions';
import type { AppPreferences } from './app-preferences.js';
import type { Setting } from './fields/setting.js';
import type { SettingValue } from './types.js';

type BindingOptions<T extends SettingValue> = Omit<
  ActionOptions<T>,
  'execute' | 'value' | 'enabled' | 'visible'
> & {
  setting: Setting<T>;
};

/** Optional adapter: AppPreferences owns persistence; the ActionList owns connection lifetime. */
class SettingBindingAction<T extends SettingValue> extends Action<T> {
  constructor(
    private settings: AppPreferences,
    private setting: Setting<T>,
    options: Omit<BindingOptions<T>, 'setting'>,
  ) {
    super({ ...options, enabled: false });
  }

  connect() {
    const sync = () => {
      const state = this.settings.get(this.setting);
      this.value = state.value;
      this.visible = state.visible;
      this.enabled = state.ready && state.writable && !state.pending;
    };
    const unsubscribe = this.settings.subscribe(this.setting, sync);
    try {
      sync();
    } catch (error) {
      unsubscribe();
      throw error;
    }
    return unsubscribe;
  }

  execute(value: T) {
    return this.settings.set(this.setting, value);
  }
}

/** Inject once at the composition root; each action declares only its setting and presentation. */
export function bindSettings(settings: AppPreferences) {
  return function createSettingAction<T extends SettingValue>({
    setting,
    ...options
  }: BindingOptions<T>): Action<T> {
    return new SettingBindingAction(settings, setting, options);
  };
}
