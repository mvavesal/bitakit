import { defineAction, type PresentationContext } from '@bitakit/core';
import type { Locale } from '@/i18n/config';

/** Forwards to the language preference; validation and persistence belong to AppPreferences. */
export default defineAction<Locale>({
  title: 'Change language',
  value: ({ services }: PresentationContext<Locale>) => services.locale.get().value,
  visible: ({ services }) => services.locale.get().visible,
  enabled: ({ services }) => {
    const state = services.locale.get();
    return state.ready && state.writable && !state.pending;
  },
  execute: ({ services, input }) => services.locale.set(input),
  success: false,
});
