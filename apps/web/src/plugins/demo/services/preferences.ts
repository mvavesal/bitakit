import { defineService } from '@bitakit/core';

/** Deliberately local: resets when the plugin is removed or the page reloads. */
export default defineService(({ store }) => {
  const state = store({ enabled: true });
  return {
    state,
    setEnabled(enabled: boolean) {
      if (state.get().enabled === enabled) return;
      state.set({ enabled });
    },
  };
});
