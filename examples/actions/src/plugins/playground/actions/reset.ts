import { defineAction } from '@bitakit/core';

// Asks first. Declining skips the run; `variant` marks it as dangerous in menus.
export default defineAction({
  title: 'Unlike everything',
  variant: 'destructive',
  enabled: ({ services }) => services.playground.demo.state.get().liked.length > 0,
  confirm: {
    title: 'Unlike everything?',
    description: 'Every liked fruit loses its like.',
    destructive: true,
  },
  execute: ({ services }) => services.playground.demo.unlikeAll(),
  success: 'All likes removed',
});
