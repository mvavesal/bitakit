import { defineAction } from '@bitakit/core';

export default defineAction({
  execute: ({ services, input }) => services.todos.tasks.create(input),
});
