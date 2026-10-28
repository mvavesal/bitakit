import { defineAction } from '@bitakit/core';

export default defineAction<boolean>({
  title: 'Enabled',
  checked: ({ services }) => services.playground.live.selected()?.enabled ?? false,
  execute: ({ input, services }) => services.playground.live.update({ enabled: input }),
});
