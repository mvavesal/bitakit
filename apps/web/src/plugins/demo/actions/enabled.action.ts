import { defineAction } from '@bitakit/core';

/** The explicit input type flows into the generated ActionMap; runtime validation stays. */
export default defineAction<boolean>({
  watch: ['demoPreferences'],
  resolve: (_, { services }) => ({ checked: services.demoPreferences.enabled }),
  execute: ({ input, services }) => {
    if (typeof input !== 'boolean') throw new Error('Expected a boolean.');
    services.demoPreferences.setEnabled(input);
  },
  success: false,
});
