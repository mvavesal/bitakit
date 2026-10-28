import { defineAction } from '@bitakit/core';

// The title is the English fallback; the catalog key `tasks.open.title` translates it.
export default defineAction({
  title: 'Tasks',
  href: '/tasks',
  slots: ['shell.navigation'],
});
