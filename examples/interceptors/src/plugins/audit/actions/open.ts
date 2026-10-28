import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Audit log',
  href: '/audit',
  slots: [{ slot: 'shell.navigation', order: -10 }],
});
