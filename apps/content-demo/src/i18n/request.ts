import { mergePluginMessages } from '@bitakit/core';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { deDE } from '@better-auth-ui/locales/de-DE';
import { enUS } from '@better-auth-ui/locales/en-US';
import en from '../../locales/en.json';
import de from '../../locales/de.json';
import { defaultLocale, isLocale, localeCookie } from './config';
import uien from '@bitakit/ui/locales/en.json';
import uide from '@bitakit/ui/locales/de.json';
import apppreferencesen from '@bitakit/app-preferences/locales/en.json';
import apppreferencesde from '@bitakit/app-preferences/locales/de.json';
import shellen from '@bitakit/shell/locales/en.json';
import shellde from '@bitakit/shell/locales/de.json';
import quicksearchen from '@bitakit/quick-search/locales/en.json';
import quicksearchde from '@bitakit/quick-search/locales/de.json';
import betterauthuien from '@bitakit/better-auth-ui/locales/en.json';
import betterauthuide from '@bitakit/better-auth-ui/locales/de.json';
import organizationsen from '@bitakit/organizations/locales/en.json';
import organizationsde from '@bitakit/organizations/locales/de.json';

import languageen from '@bitakit/next-intl/locales/en.json';
import languagede from '@bitakit/next-intl/locales/de.json';

const catalogs = [
  { en: languageen, de: languagede },
  { en: uien, de: uide },
  { en: apppreferencesen, de: apppreferencesde },
  { en: shellen, de: shellde },
  { en: quicksearchen, de: quicksearchde },
  { en: betterauthuien, de: betterauthuide },
  { en: organizationsen, de: organizationsde },
  { en: { betterAuth: enUS }, de: { betterAuth: deDE } },
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
