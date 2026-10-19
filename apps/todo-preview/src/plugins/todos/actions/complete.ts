import { defineAction } from '@bitakit/core';

export default defineAction<{ id: string; completed: boolean }>({
  title: ({ input }) => (input?.completed ? 'Complete' : 'Reopen'),
  execute: ({ services, input }) => services.todos.items.complete(input.id, input.completed),
});
