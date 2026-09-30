import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.delete',
  requires: ['todos'],
  execute: ({ services, input }) => services.todos.delete(input),
});
