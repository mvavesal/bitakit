import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Customers',
  href: '/customers',
  slots: [{ slot: 'shell.navigation', order: -20 }],
});
