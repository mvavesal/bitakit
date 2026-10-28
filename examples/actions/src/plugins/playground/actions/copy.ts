import { defineAction } from '@bitakit/core';

// In the `playground.more` group: ActionMenu lists the group's Actions as menu items.
export default defineAction({
  title: 'Copy the count',
  groups: ['playground.more'],
  execute: async ({ services }) => {
    await navigator.clipboard.writeText(String(services.playground.demo.state.get().count));
  },
  success: 'Copied',
});
