import { defineAction } from '@bitakit/core';

// The controls are Actions too, each a few lines that change one field of the state. The
// title field is bound to this one: `value` fills it, and every keystroke runs it.
export default defineAction<string>({
  title: 'Title',
  value: ({ services }) => services.playground.live.state.get().title,
  execute: ({ input, services }) => services.playground.live.set({ title: input.slice(0, 24) }),
});
