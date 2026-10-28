import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Add an item',
  enabled: ({ services }) => services.playground.live.state.get().samples < 3,
  execute: ({ services }) => services.playground.live.addSample(),
});
