import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Playground',
  href: '/playground',
  slots: [{ slot: 'shell.navigation', order: -20 }],
});
