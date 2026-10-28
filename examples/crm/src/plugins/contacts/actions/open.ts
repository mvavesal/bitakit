import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Contacts',
  href: '/contacts',
  slots: [{ slot: 'shell.navigation', order: -30 }],
});
