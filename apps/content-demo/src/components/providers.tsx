'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createAppPreferences, createLocalStorage } from '@bitakit/app-preferences';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import { useNextIntlPlugin } from '@bitakit/next-intl';
import { BitaKitProvider } from '../bitakit.gen';
import { createContentAuth } from '../auth';
import { loadLocale, resetLocale, saveLocale } from '../i18n/actions';
import { language } from '../i18n/preferences';

/** The generated configuration plus this host's preferences, language, translation and authentication. */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const translation = useNextIntlPlugin();
  // Preferences register through plugin contributions; the same browser keys stay in use.
  const [settings] = useState(() =>
    createAppPreferences({
      storage: language.storage(createLocalStorage({ prefix: 'content-demo.settings.' }), {
        load: loadLocale,
        save: saveLocale,
        reset: resetLocale,
      }),
    }),
  );
  const [authentication] = useState(() =>
    createContentAuth(settings, ({ to, replace }) =>
      replace ? router.replace(to) : router.push(to),
    ),
  );
  // app-preferences replaces the discovered package plugin of the same ID in place.
  const plugins = useMemo(
    () => [
      translation,
      appPreferencesPlugin({ settings }),
      language.plugin,
      ...authentication.plugins,
    ],
    [settings, authentication, translation],
  );
  return <BitaKitProvider additionalPlugins={plugins}>{children}</BitaKitProvider>;
}
