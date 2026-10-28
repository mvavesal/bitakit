import { defineAction } from '@bitakit/core';

export default defineAction<boolean>({
  title: 'Visible',
  checked: ({ services }) => services.playground.live.state.get().visible,
  execute: ({ input, services }) => services.playground.live.set({ visible: input }),
});
