import { mergePluginMessages } from '@bitakit/core';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import discovered from '../bitakit.gen.messages.json';
import uien from '@bitakit/ui/locales/en.json';
import uide from '@bitakit/ui/locales/de.json';
import preferencesen from '@bitakit/app-preferences/locales/en.json';
import preferencesde from '@bitakit/app-preferences/locales/de.json';
import shellen from '@bitakit/shell/locales/en.json';
import shellde from '@bitakit/shell/locales/de.json';
import searchen from '@bitakit/quick-search/locales/en.json';
import searchde from '@bitakit/quick-search/locales/de.json';
import intlen from '@bitakit/next-intl/locales/en.json';
import intlde from '@bitakit/next-intl/locales/de.json';
import en from '../../locales/en.json';
import de from '../../locales/de.json';
import { defaultLocale, isLocale, localeCookie } from './config';

// Package catalogs first, then the playground plugins' own catalogs (discovered).
const catalogs = [
  { en: uien, de: uide },
  { en: preferencesen, de: preferencesde },
  { en: shellen, de: shellde },
  { en: searchen, de: searchde },
  { en: intlen, de: intlde },
  discovered,
];

export default getRequestConfig(async () => {
  const preference = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(preference) ? preference : defaultLocale;
  const plugins = Object.fromEntries(
    [...new Set(catalogs.flatMap((catalog) => Object.keys(catalog)))].map((language) => [
      language,
      catalogs.reduce(
        (messages, catalog) =>
          mergePluginMessages({
            locale: language,
            fallbackLocale: language,
            app: catalog,
            plugins: { [language]: messages },
          }),
        {},
      ),
    ]),
  );
  return {
    locale,
    messages: mergePluginMessages({ locale, app: { en, de }, plugins }),
    timeZone: 'UTC',
  };
});
