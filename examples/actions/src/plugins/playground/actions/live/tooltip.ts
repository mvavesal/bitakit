import { defineAction } from '@bitakit/core';

// Bound to the tooltip field like the title; an empty tooltip removes it.
export default defineAction<string>({
  title: 'Tooltip',
  value: ({ services }) => services.playground.live.state.get().tooltip,
  execute: ({ input, services }) => services.playground.live.set({ tooltip: input.slice(0, 60) }),
});
