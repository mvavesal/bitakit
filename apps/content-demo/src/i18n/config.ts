export const locales = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'de', label: '🇩🇪 Deutsch' },
] as const;
export type Locale = (typeof locales)[number]['value'];
export const defaultLocale: Locale = 'de';
export const localeCookie = 'saas-foundation.locale';
export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale.value === value);
}
