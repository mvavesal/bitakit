import { languagePreferences } from '@bitakit/next-intl/preferences';
import { defaultLocale, locales } from './config';

export const language = languagePreferences({
  locales,
  defaultLocale,
  category: { id: 'personal', title: 'My account', order: 0 },
});
