'use client';
import { useEffect, useState, startTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { createAppPreferences, SettingsProvider } from '@bitakit/app-preferences';
import { authClient } from '@/lib/auth-client';
import { settingsStorage } from '@/settings/storage';
import { settingDefinitions, themeSetting, localeSetting } from '@/settings/definitions';
import { standardSettings } from '@/settings/standard-settings';
import { THEME_STORAGE_KEY } from '@/lib/theme/config';
import { getThemeSnapshot, setThemePreference } from '@/lib/theme/store';
import { setLocale } from '@/i18n/set-locale';

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { data: session } = authClient.useSession();
  const [settings] = useState(() => {
    const list = createAppPreferences({
      storage: settingsStorage,
      definitions: settingDefinitions,
    });
    standardSettings(t).forEach((section) => list.add(section));
    return list;
  });
  useEffect(() => {
    standardSettings(t).forEach((section) => settings.updateSection(section.id, section));
  }, [settings, t]);
  useEffect(() => {
    const syncTheme = () => {
      const state = settings.get(themeSetting);
      if (state.ready && state.value !== getThemeSnapshot().split(':')[0])
        setThemePreference(state.value);
    };
    const syncLocale = () => {
      const state = settings.get(localeSetting);
      if (state.ready && state.value !== document.documentElement.lang) {
        startTransition(async () => {
          await setLocale(state.value);
        });
      }
    };
    const themeOff = settings.subscribe(themeSetting, syncTheme);
    const localeOff = settings.subscribe(localeSetting, syncLocale);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null)
        void settings.refresh(themeSetting);
    };
    window.addEventListener('storage', onStorage);
    syncTheme();
    syncLocale();
    return () => {
      themeOff();
      localeOff();
      window.removeEventListener('storage', onStorage);
    };
  }, [settings]);
  return (
    <SettingsProvider
      settings={settings}
      context={{
        userId: session?.user.id,
        organizationId: session?.session.activeOrganizationId ?? undefined,
      }}
    >
      {children}
    </SettingsProvider>
  );
}
