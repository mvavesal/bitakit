import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Delete',
  // Each row tracks its own pending state.
  concurrency: 'per-input',
  confirm: 'Delete this task?',
  execute: ({ services, input }) => services.todos.items.remove(input),
});
