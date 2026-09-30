import { definePlugin } from '@bitakit/core';
import {
  SelectSetting,
  defineSettingsSection,
  type SectionOptions,
  type SettingsStorage,
} from '@bitakit/app-preferences/core';

/** Declares language selection through the existing preferences catalog and standard controls. */
export function languagePreferences<T extends string>(options: {
  locales: readonly { value: T; label: string }[];
  defaultLocale: T;
  category?: SectionOptions['category'];
}) {
  const setting = new SelectSetting<T>({
    key: 'language.locale',
    title: 'Language',
    titleKey: 'language.label',
    defaultValue: options.defaultLocale,
    scope: 'user',
    options: options.locales,
    presentation: { variant: 'select' },
  });
  const plugin = definePlugin({
    id: 'language',
    dependencies: ['app-preferences'],
    contributions: {
      settings: [setting],
      'settings.sections': [
        defineSettingsSection({
          id: 'language',
          title: { key: 'language.title', fallback: 'Language' },
          description: { key: 'language.description', fallback: 'Choose your interface language.' },
          category: options.category,
          settings: [setting],
        }),
      ],
    },
  });
  return {
    setting,
    plugin,
    /** Routes only the language key to host persistence; other settings keep their storage. */
    storage(
      base: SettingsStorage,
      persistence: {
        load: () => Promise<T>;
        save: (locale: T) => Promise<void>;
        reset: () => Promise<T>;
      },
    ): SettingsStorage {
      return {
        load: (key, context) =>
          key === setting.key
            ? persistence.load().then((value) => ({ value, writable: true }))
            : base.load(key, context),
        save: (key, value, context) =>
          key === setting.key
            ? persistence.save(setting.parse(value))
            : base.save(key, value, context),
        ...(base.reset
          ? {
              reset: (key: string, context: Parameters<SettingsStorage['load']>[1]) =>
                key === setting.key
                  ? persistence.reset().then((value) => ({ value, writable: true }))
                  : base.reset!(key, context),
            }
          : {}),
      };
    },
  };
}
