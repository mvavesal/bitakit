import {
  definePlugin,
  defineSettings,
  setting,
  type SettingsContext,
  type SettingsStorage,
} from '@bitakit/core';

/** Declares the interface language as a setting; the generated settings page renders it. */
export function languagePreferences<T extends string>(options: {
  locales: readonly { value: T; label: string }[];
  defaultLocale: T;
  /** Settings category of the generated page; defaults to `general`. */
  category?: string;
}) {
  const key = 'language.locale';
  const locales = new Set<string>(options.locales.map((locale) => locale.value));
  const plugin = definePlugin({
    id: 'language',
    metadata: { name: 'Language', description: 'Interface language.' },
    settings: defineSettings(
      {
        locale: setting({
          default: options.defaultLocale,
          options: options.locales,
          control: 'select',
          label: 'Language',
        }),
      },
      {
        title: 'Language',
        description: 'Choose your interface language.',
        category: options.category ?? 'general',
        order: -8,
      },
    ),
  });
  const parse = (value: unknown): T => {
    if (typeof value !== 'string' || !locales.has(value))
      throw new Error(`Unsupported locale "${String(value)}".`);
    return value as T;
  };
  return {
    key,
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
        load: (name, context) =>
          name === key
            ? persistence.load().then((value) => ({ value, writable: true }))
            : base.load(name, context),
        save: (name, value, context) =>
          name === key ? persistence.save(parse(value)) : base.save(name, value, context),
        ...(base.reset
          ? {
              reset: (name: string, context: SettingsContext) =>
                name === key
                  ? persistence.reset().then((value) => ({ value, writable: true }))
                  : base.reset!(name, context),
            }
          : {}),
      };
    },
  };
}
