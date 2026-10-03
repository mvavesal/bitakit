import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear all',
  enabled: ({ services }) => {
    const state = services.todos.items.state.get();
    return Boolean(state.organizationId) && !state.pending && state.items.length > 0;
  },
  groups: ['apps'],
  confirm: ({ services }) => services.todos.items.confirmClear(),
  execute: ({ services }) => services.todos.items.clear(),
  success: 'All tasks have been cleared.',
});
