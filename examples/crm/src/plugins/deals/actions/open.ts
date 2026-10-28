import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Deals',
  href: '/deals',
  slots: [{ slot: 'shell.navigation', order: -20 }],
});
