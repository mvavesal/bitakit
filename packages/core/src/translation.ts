import { provideService } from './service-key.js';
import type { Translator } from './definitions.js';
import { definePlugin } from './definitions.js';
import { translationService, type TranslationService } from './contracts.js';

/** Shared key-or-literal resolution for automatic and imperatively registered Actions. */
export function resolveText(
  translate: Translator,
  value: string | undefined,
  fallback = value ?? '',
  values?: Parameters<Translator>[1],
): string {
  if (!value || (translate.has && !translate.has(value))) return fallback;
  try {
    const translated = translate(value, values);
    return typeof translated === 'string' && translated !== value ? translated : fallback;
  } catch {
    return fallback;
  }
}
/** Adapter primitive. No locale store: the current translator delegates to its provider. */
export function createTranslationPlugin(initial: Translator, catalog?: TranslationService['getCatalog']) {
  let current = initial;
  let currentCatalog = catalog;
  const listeners = new Set<() => void>();
  const translate: Translator = (key, values) => current(key, values);
  translate.has = (key) => current.has?.(key) ?? true;
  const service: TranslationService = {
    translate,
    getCatalog: (namespace) => currentCatalog?.(namespace),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return definePlugin({
    id: 'translation',
    services: [provideService(translationService, { create: () => service })],
    translation: service,
    update(next: Translator, nextCatalog = currentCatalog) {
      current = next;
      currentCatalog = nextCatalog;
      listeners.forEach((listener) => listener());
    },
  });
}
