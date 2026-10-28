import { defineAction } from '@bitakit/core';

// The smallest Action: a title, what it does and a message afterwards.
export default defineAction({
  title: 'Say hello',
  execute: () => undefined,
  success: 'Hello from an Action!',
});
