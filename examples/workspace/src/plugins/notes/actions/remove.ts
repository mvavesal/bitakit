import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Delete',
  concurrency: 'per-input',
  execute: ({ services, input }) => services.notes.list.remove(input),
});
