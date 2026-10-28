/** The languages of this app. Adding one means a new entry here and a catalog per plugin. */
export const locales = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
] as const;
export type Locale = (typeof locales)[number]['value'];
export const defaultLocale: Locale = 'en';
/** The cookie that remembers the chosen language; request.ts reads it on every request. */
export const localeCookie = 'locale';
export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale.value === value);
}
