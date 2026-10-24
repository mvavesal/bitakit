import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Reset',
  enabled: ({ services }) => services.counter.value.state.get().count > 0,
  execute: ({ services }) => services.counter.value.reset(),
});
