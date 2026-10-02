import { defineAction, type PresentationContext } from '@bitakit/core';
import type { ThemePreference } from '@/lib/theme/config';

/** Forwards to the theme preference; validation and persistence belong to AppPreferences. */
export default defineAction<ThemePreference>({
  title: 'Change theme',
  value: ({ services }: PresentationContext<ThemePreference>) => services.theme.get().value,
  visible: ({ services }) => services.theme.get().visible,
  enabled: ({ services }) => {
    const state = services.theme.get();
    return state.ready && state.writable && !state.pending;
  },
  execute: ({ services, input }) => services.theme.set(input),
  success: false,
});
