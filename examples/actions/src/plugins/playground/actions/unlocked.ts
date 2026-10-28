import { defineAction } from '@bitakit/core';

// Hidden until the counter reaches 3: `visible: false` renders nothing and blocks runs.
export default defineAction({
  title: 'Secret button',
  visible: ({ services }) => services.playground.demo.state.get().count >= 3,
  execute: () => undefined,
  success: 'You found it.',
});
