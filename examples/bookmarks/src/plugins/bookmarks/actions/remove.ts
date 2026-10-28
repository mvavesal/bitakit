import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Delete',
  // Each row has its own pending state, so deleting one does not block the others.
  concurrency: 'per-input',
  execute: ({ services, input }) => services.bookmarks.list.remove(input),
  success: 'Bookmark deleted',
});
