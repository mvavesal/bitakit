import { defineAction } from '@bitakit/core';

export default defineAction<{ id: string; title: string }>({
  title: 'Save',
  enabled: ({ input }) => Boolean(input?.title.trim()),
  execute: ({ services, input }) => services.todos.items.edit(input.id, input.title),
});
