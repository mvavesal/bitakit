import { createLocalSettingsStorage, defineService, settingsStorage } from '@bitakit/core';
import { loadLocale, resetLocale, saveLocale } from '../i18n/actions';
import { language } from '../i18n/preferences';

export default defineService(
  () =>
    language.storage(createLocalSettingsStorage(), {
      load: loadLocale,
      save: saveLocale,
      reset: resetLocale,
    }),
  { provides: settingsStorage },
);
