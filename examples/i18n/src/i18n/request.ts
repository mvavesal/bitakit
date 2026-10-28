import { mergePluginMessages } from '@bitakit/core';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import appPreferencesDe from '@bitakit/app-preferences/locales/de.json';
import appPreferencesEn from '@bitakit/app-preferences/locales/en.json';
import languageDe from '@bitakit/next-intl/locales/de.json';
import languageEn from '@bitakit/next-intl/locales/en.json';
import quickSearchDe from '@bitakit/quick-search/locales/de.json';
import quickSearchEn from '@bitakit/quick-search/locales/en.json';
import shellDe from '@bitakit/shell/locales/de.json';
import shellEn from '@bitakit/shell/locales/en.json';
import uiDe from '@bitakit/ui/locales/de.json';
import uiEn from '@bitakit/ui/locales/en.json';
import de from '../../locales/de.json';
import en from '../../locales/en.json';
// Discovery collects src/plugins/<id>/locales/<lang>.json into this file.
import discovered from '../bitakit.gen.messages.json';
import { defaultLocale, isLocale, localeCookie } from './config';

// Each package and plugin keeps its texts under its own namespace, so they combine side by side.
const plugins = {
  en: {
    ...uiEn,
    ...shellEn,
    ...appPreferencesEn,
    ...quickSearchEn,
    ...languageEn,
    ...discovered.en,
  },
  de: {
    ...uiDe,
    ...shellDe,
    ...appPreferencesDe,
    ...quickSearchDe,
    ...languageDe,
    ...discovered.de,
  },
};

export default getRequestConfig(async () => {
  const preference = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(preference) ? preference : defaultLocale;
  return {
    locale,
    // English fills any key a language misses; the app's own catalogs win over plugins.
    messages: mergePluginMessages({ locale, app: { en, de }, plugins }),
    timeZone: 'UTC',
  };
});
