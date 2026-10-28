import { defineAction } from '@bitakit/core';

// Asks first. Declining skips the run; `variant` marks it as dangerous in menus.
export default defineAction({
  title: 'Reset the playground',
  variant: 'destructive',
  confirm: {
    title: 'Reset everything?',
    description: 'The counter, likes, favorite and sort order go back to the start.',
    destructive: true,
  },
  execute: ({ services }) => services.playground.demo.reset(),
  success: 'Playground reset',
});
