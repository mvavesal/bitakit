import { defineAction } from '@bitakit/core';

// Makes the live Action's icon bounce wherever it is shown, for three seconds.
export default defineAction({
  title: 'Show me where',
  enabled: ({ services }) => services.playground.live.state.get().visible,
  execute: ({ services }) => services.playground.live.spotlight(),
});
