import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add task',
  enabled: ({ input, services }) => typeof input === 'string' && input.trim().length > 0 && Boolean(services.todos.items.state.get().organizationId),
  execute: ({ services, input }) => services.todos.items.add(input),
});
