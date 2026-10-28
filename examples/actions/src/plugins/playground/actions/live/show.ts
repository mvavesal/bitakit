import { defineAction } from '@bitakit/core';

export default defineAction<boolean>({
  title: 'Visible',
  checked: ({ services }) => services.playground.live.selected()?.visible ?? false,
  execute: ({ input, services }) => services.playground.live.update({ visible: input }),
});
