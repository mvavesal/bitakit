import { defineAction } from '@bitakit/core';
import { wait } from './-wait';

// 'per-input': each row has its own pending state, so liking one does not block the others.
export default defineAction<string>({
  title: ({ input, services }) =>
    services.playground.demo.state.get().liked.includes(input ?? '') ? 'Unlike' : 'Like',
  concurrency: 'per-input',
  execute: async ({ input, services, signal }) => {
    await wait(1000, signal);
    services.playground.demo.toggleLike(input);
  },
});
