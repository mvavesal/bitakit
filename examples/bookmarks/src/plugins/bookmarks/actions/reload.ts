import { defineAction } from '@bitakit/core';

// Offered when loading failed, instead of asking for a page reload.
export default defineAction({
  title: 'Try again',
  execute: ({ services }) => services.bookmarks.list.reload(),
});
