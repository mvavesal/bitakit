import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.create',
  requires: ['todos'],
  execute: ({ services, input }) => services.todos.create(input),
});
