import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Changelog',
  href: '/changelog',
  slots: [{ slot: 'shell.navigation', order: -10 }],
});
