import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Remove the selected',
  enabled: ({ services }) => services.playground.live.selected() !== undefined,
  execute: ({ services }) => services.playground.live.remove(),
});
