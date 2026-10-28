import { createLocalSettingsStorage, defineService, settingsStorage } from '@bitakit/core';
import { loadLocale, resetLocale, saveLocale } from '../i18n/actions';
import { language } from '../i18n/language';

// Where settings are saved: `language.locale` in the locale cookie through server actions,
// every other setting in this browser as before.
export default defineService(
  () =>
    language.storage(createLocalSettingsStorage(), {
      load: loadLocale,
      save: saveLocale,
      reset: resetLocale,
    }),
  { provides: settingsStorage },
);
