import { defineAction } from '@bitakit/core';

// A throw fails the run; `failure` words the message.
export default defineAction({
  title: 'Try something risky',
  execute: () => {
    throw new Error('The server is taking a break.');
  },
  failure: ({ error }) => `That failed: ${error instanceof Error ? error.message : String(error)}`,
});
