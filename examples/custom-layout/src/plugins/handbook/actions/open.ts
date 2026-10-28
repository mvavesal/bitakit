import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Handbook',
  href: '/handbook',
  slots: [{ slot: 'shell.navigation', order: -20 }],
});
