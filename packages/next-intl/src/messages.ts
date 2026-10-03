import {
  createStore,
  type TranslationCatalog,
  type TranslationService,
  type Translator,
} from '@bitakit/core';

/** The part of next-intl's `useTranslations()` result the translation service reads. */
export type NextIntlTranslator = {
  (key: string, values?: Parameters<Translator>[1]): string;
  has(key: string): boolean;
  raw(key: string): unknown;
};
type Current = { t?: NextIntlTranslator; messages?: unknown };

/**
 * The translation service and the store behind it. Services are created when the runtime
 * mounts, after the first render, so the store lives with the plugin instance: the provider
 * publishes next-intl's current translator and messages, the service reads them. Until the
 * first publish, `translate.has` is false and texts fall back to their literals.
 */
export function createMessageBridge() {
  const state = createStore<Current>({});
  const translate: Translator = (key, values) => state.get().t?.(key, values) ?? key;
  translate.has = (key) => {
    const t = state.get().t;
    return !!t && t.has(key) && typeof t.raw(key) === 'string';
  };
  const service: TranslationService = {
    translate,
    getCatalog: (namespace) => catalogAt(state.get().messages, namespace),
    subscribe: (listener) => state.subscribe(() => listener()),
  };
  /** Notifies only when the translator or the messages changed. */
  const publish = (t: NextIntlTranslator, messages: unknown) => {
    const current = state.get();
    if (current.t !== t || current.messages !== messages) state.set({ t, messages });
  };
  return { service, publish };
}

/** The nested message group at `namespace`, the full catalog without one, else undefined. */
function catalogAt(messages: unknown, namespace?: string): TranslationCatalog | undefined {
  let value = messages;
  for (const part of namespace?.split('.') ?? []) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as TranslationCatalog)
    : undefined;
}
