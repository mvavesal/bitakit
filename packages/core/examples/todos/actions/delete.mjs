import { defineAction } from '@bitakit/core';

export default defineAction({
  // Re-evaluated whenever the tasks store changes: disabled while the list is empty.
  enabled: ({ services }) => services.todos.tasks.state.get().items.length > 0,
  execute: ({ services, input }) => services.todos.tasks.delete(input),
});
