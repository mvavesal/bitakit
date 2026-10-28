import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Companies',
  href: '/companies',
  slots: [{ slot: 'shell.navigation', order: -40 }],
});
