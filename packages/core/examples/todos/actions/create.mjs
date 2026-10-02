import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.create',
  execute: ({ services, input }) => services.todos.create(input),
});
