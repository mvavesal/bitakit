'use client';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import type { Translator, TranslationService, TranslationCatalog } from '@bitakit/core';
import { createTranslationPlugin } from '@bitakit/core';

/** Use inside NextIntlClientProvider. Its messages and locale remain authoritative. */
export function useNextIntlPlugin() {
  const t = useTranslations();
  const messages = useMessages();
  const getCatalog = useMemo<NonNullable<TranslationService['getCatalog']>>(() => (namespace) => {
    let value: unknown = messages;
    for (const part of namespace?.split('.') ?? []) {
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as TranslationCatalog : undefined;
  }, [messages]);
  const translate = useMemo(() => {
    const translate: Translator = (key, values) => t(key, values);
    translate.has = (key) => t.has(key) && typeof t.raw(key) === 'string';
    return translate;
  }, [t]);
  const [integration] = useState(() => createTranslationPlugin(translate, getCatalog));
  useLayoutEffect(() => integration.update(translate, getCatalog), [integration, translate, getCatalog]);
  return integration;
}
