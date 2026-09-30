import { SelectSetting } from '@bitakit/app-preferences/core';
import type { ThemePreference } from '@/lib/theme/config';
import type { Locale } from '@/i18n/config';
export const themeSetting = new SelectSetting<ThemePreference>({
  key: 'appearance.theme',
  title: 'Theme',
  titleKey: 'Appearance.color',
  presentation: { variant: 'cards', columns: 3 },
  defaultValue: 'system',
  scope: 'user',
  environmentDefault: 'APP_DEFAULT_THEME',
  options: [
    {
      value: 'light',
      label: 'Light',
      labelKey: 'Appearance.light',
      descriptionKey: 'Appearance.lightDescription',
    },
    {
      value: 'dark',
      label: 'Dark',
      labelKey: 'Appearance.dark',
      descriptionKey: 'Appearance.darkDescription',
    },
    {
      value: 'system',
      label: 'System',
      labelKey: 'Appearance.system',
      descriptionKey: 'Appearance.systemDescription',
    },
  ],
});
export const localeSetting = new SelectSetting<Locale>({
  key: 'language.locale',
  title: 'Language',
  titleKey: 'Language.label',
  presentation: { variant: 'select' },
  defaultValue: 'en',
  scope: 'user',
  environmentDefault: 'APP_DEFAULT_LOCALE',
  options: [
    { value: 'en', label: '🇬🇧 English' },
    { value: 'de', label: '🇩🇪 Deutsch' },
  ],
});
// Trusted plugins add definitions here on both server and client before exposing fields.
// Client registration alone never authorizes database access.
export const settingDefinitions = [themeSetting, localeSetting] as const;
