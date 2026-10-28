import { defineAction } from '@bitakit/core';

// The link in the navigation; the page is ui/pages/index.tsx.
export default defineAction({
  title: 'Bookmarks',
  href: '/bookmarks',
  slots: ['shell.navigation'],
});
