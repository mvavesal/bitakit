import { defineAction } from '@bitakit/core';

// A toggle: the checkbox shows `checked` and passes the new value as input.
export default defineAction<boolean>({
  title: 'Enabled',
  checked: ({ services }) => services.playground.live.state.get().enabled,
  execute: ({ input, services }) => services.playground.live.set({ enabled: input }),
});
