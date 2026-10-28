import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Reset',
  execute: ({ services }) => services.playground.live.reset(),
});
