import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Delete',
  concurrency: 'per-input',
  execute: ({ services, input }) => services.todos.list.remove(input),
});
