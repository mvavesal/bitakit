import type { LocalizedText } from './types.js';

/** A translator in the shape next-intl and the Foundation i18n service already provide. */
export type SettingsTranslator = ((key: string) => string) & { has?: (key: string) => boolean };

export function localizedKey(text: LocalizedText | undefined) {
  return typeof text === 'object' ? text.key : undefined;
}
export function localizedFallback(text: LocalizedText | undefined) {
  return typeof text === 'object' ? text.fallback : text;
}

/** Resolves an explicit key first, then an optional conventional key, then the fallback text. */
export function resolveLocalized(
  translate: SettingsTranslator | undefined,
  keys: readonly (string | undefined)[],
  fallback: string,
): string {
  if (!translate) return fallback;
  for (const key of keys) {
    if (!key) continue;
    if (translate.has && !translate.has(key)) continue;
    try {
      const value = translate(key);
      if (typeof value === 'string' && value && value !== key) return value;
    } catch {
      // A missing translation must never break a settings page.
    }
  }
  return fallback;
}

/** "pageSize" → "Page size"; used when a definition declares no title. */
export function humanize(name: string) {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
