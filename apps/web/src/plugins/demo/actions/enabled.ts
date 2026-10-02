import { defineAction } from '@bitakit/core';

/** The explicit input type flows into the generated ActionMap; runtime validation stays. */
export default defineAction<boolean>({
  // Re-evaluated whenever the preferences store changes.
  checked: ({ services }) => services.demo.preferences.state.get().enabled,
  execute: ({ input, services }) => {
    if (typeof input !== 'boolean') throw new Error('Expected a boolean.');
    services.demo.preferences.setEnabled(input);
  },
  success: false,
});
