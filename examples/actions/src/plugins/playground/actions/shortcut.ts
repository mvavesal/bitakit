import { defineAction } from '@bitakit/core';

// A keyboard shortcut with the same guards as a click; it works without a rendered button.
export default defineAction({
  title: 'Shout',
  shortcut: { keys: 'Mod+Shift+H' },
  execute: () => undefined,
  success: 'You pressed the shortcut',
});
