import { defineService, getService } from '@bitakit/core';
import { settingsService } from '@bitakit/app-preferences/foundation';
import type { Locale } from '@/i18n/config';
import { localeSetting } from '@/settings/definitions';

/** The language preference as an observable service; AppPreferences owns the value. */
export default defineService(
  ({ services }) => {
    const settings = getService(services, settingsService);
    return {
      get: () => settings.get(localeSetting),
      set: (value: Locale) => settings.set(localeSetting, value),
      subscribe: (listener: () => void) => settings.subscribe(localeSetting, listener),
    };
  },
  { requires: ['settings'] },
);
