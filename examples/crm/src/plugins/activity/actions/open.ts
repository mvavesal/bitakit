import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Activity',
  href: '/activity',
  slots: [{ slot: 'shell.navigation', order: -10 }],
});
