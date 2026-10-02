import { defineService, getService } from '@bitakit/core';
import { settingsService } from '@bitakit/app-preferences/foundation';
import type { ThemePreference } from '@/lib/theme/config';
import { themeSetting } from '@/settings/definitions';

/**
 * The theme preference as an observable service. AppPreferences stays the owner of the value;
 * this forwards reads, writes and subscriptions so actions can follow it.
 */
export default defineService(
  ({ services }) => {
    const settings = getService(services, settingsService);
    return {
      get: () => settings.get(themeSetting),
      set: (value: ThemePreference) => settings.set(themeSetting, value),
      subscribe: (listener: () => void) => settings.subscribe(themeSetting, listener),
    };
  },
  { requires: ['settings'] },
);
