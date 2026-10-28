import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Save',
  // Bound buttons stay disabled until the input is a full URL.
  enabled: ({ input }) => URL.canParse(input?.trim() ?? ''),
  // Return the promise: the button shows pending until the server answers; a throw fails the run.
  execute: ({ services, input }) => services.bookmarks.list.add(input.trim()),
  success: 'Bookmark saved',
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not save the bookmark.'),
});
