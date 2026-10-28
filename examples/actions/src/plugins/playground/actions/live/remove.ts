import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Remove an item',
  enabled: ({ services }) => services.playground.live.state.get().samples > 0,
  execute: ({ services }) => services.playground.live.removeSample(),
});
