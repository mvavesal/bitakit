import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Dashboard',
  href: '/dashboard',
  slots: [{ slot: 'shell.navigation', order: -10 }],
});
