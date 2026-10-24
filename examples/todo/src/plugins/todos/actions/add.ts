import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add',
  // Bound buttons stay disabled while the input is empty.
  enabled: ({ input }) => !!input?.trim(),
  execute: ({ services, input }) => services.todos.list.add(input),
});
