import { defineAction } from '@bitakit/core';

// A title computed from a service: every bound control updates when the count changes.
export default defineAction({
  title: ({ services }) => {
    const count = services.playground.demo.state.get().count;
    return count === 0 ? 'Click me' : `Clicked ${count} ${count === 1 ? 'time' : 'times'}`;
  },
  execute: ({ services }) => services.playground.demo.increment(),
});
