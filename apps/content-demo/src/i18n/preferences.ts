import { languagePreferences } from '@bitakit/next-intl/preferences';
import { defaultLocale, locales } from './config';

export const language = languagePreferences({
  locales,
  defaultLocale,
  category: 'personal',
});
