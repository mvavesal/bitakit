import { defineAction } from '@bitakit/core';

export default defineAction<boolean>({
  title: 'Takes a second',
  checked: ({ services }) => services.playground.live.selected()?.slow ?? false,
  execute: ({ input, services }) => services.playground.live.update({ slow: input }),
});
