import { languagePreferences } from '@bitakit/next-intl/preferences';
import { defaultLocale, locales } from './config';

/**
 * The interface language as a setting (`language.locale`), from @bitakit/next-intl. Its
 * settings declaration is discovered through src/plugins/language/settings.ts; its `storage`
 * routes the value to the locale cookie in src/services/settings-storage.ts.
 */
export const language = languagePreferences({ locales, defaultLocale });
