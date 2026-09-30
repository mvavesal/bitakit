'use client';
import { language } from '../i18n/preferences';
import { loadLocale, saveLocale, resetLocale } from '../i18n/actions';
import { useNextIntlPlugin } from '@bitakit/next-intl';
import { useRouter } from 'next/navigation';
import { createContentAuth } from '../auth';
import { createAppPreferences, createLocalStorage } from '@bitakit/app-preferences';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import { useState, useMemo, type ReactNode } from 'react';
import { FoundationProvider } from '@bitakit/next';
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
  const plugins = useMemo(
    () => [
      translation,
      appPreferencesPlugin({ settings }),
      language.plugin,
      ...authentication.plugins,
    ],
    [settings, authentication, translation],
  );
  return <FoundationProvider additionalPlugins={plugins}>{children}</FoundationProvider>;
}
