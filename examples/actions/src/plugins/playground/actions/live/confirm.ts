import { defineAction } from '@bitakit/core';

export default defineAction<boolean>({
  title: 'Ask first',
  checked: ({ services }) => services.playground.live.selected()?.confirm ?? false,
  execute: ({ input, services }) => services.playground.live.update({ confirm: input }),
});
