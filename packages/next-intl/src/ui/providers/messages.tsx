'use client';
import { useLayoutEffect, type ReactNode } from 'react';
import { useMessages, useTranslations } from 'next-intl';
import type { NextIntlTranslator } from '../../messages.js';

/**
 * The provider that feeds next-intl into the plugin's translation service. It renders inside
 * the host's `NextIntlClientProvider` and publishes in a layout effect: before the runtime
 * mounts on the first render, and before paint when the locale or the messages change.
 */
export function nextIntlMessages(publish: (t: NextIntlTranslator, messages: unknown) => void) {
  return function NextIntlMessages({ children }: { children: ReactNode }) {
    const t = useTranslations();
    const messages = useMessages();
    useLayoutEffect(() => publish(t, messages), [t, messages]);
    return <>{children}</>;
  };
}
