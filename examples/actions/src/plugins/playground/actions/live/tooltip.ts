import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Tooltip',
  value: ({ services }) => services.playground.live.selected()?.tooltip ?? '',
  execute: ({ input, services }) => services.playground.live.update({ tooltip: input }),
});
