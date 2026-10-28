import { defineAction } from '@bitakit/core';

// In the `playground.more` group: ActionMenu lists the group's Actions as menu items.
export default defineAction({
  title: 'Copy the liked fruit',
  groups: ['playground.more'],
  execute: async ({ services }) => {
    await navigator.clipboard.writeText(services.playground.demo.state.get().liked.join(', '));
  },
  success: 'Copied',
});
