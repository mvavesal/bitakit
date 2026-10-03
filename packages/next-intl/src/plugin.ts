'use client';
import { definePlugin, defineService, translationService } from '@bitakit/core';
import { createMessageBridge } from './messages.js';
import { nextIntlMessages } from './ui/providers/messages.js';

/**
 * next-intl as the `i18n` translation service. Render the app inside `NextIntlClientProvider`;
 * its locale and messages stay authoritative, the plugin keeps no locale store of its own.
 */
export function nextIntlPlugin() {
  const bridge = createMessageBridge();
  return definePlugin({
    id: 'next-intl',
    metadata: {
      name: 'next-intl',
      description: 'Translations and message catalogs from next-intl.',
    },
    services: {
      translation: defineService(() => bridge.service, { provides: translationService }),
    },
    ui: { providers: [{ id: 'next-intl.messages', component: nextIntlMessages(bridge.publish) }] },
  });
}
export default nextIntlPlugin;
