import { defineAction } from '@bitakit/core';

export default defineAction({
  // Re-evaluated whenever the list store changes: disabled while the list is empty.
  enabled: ({ services }) => services.todos.list.state.get().todos.length > 0,
  execute: ({ services, input }) => services.todos.list.delete(input),
});
