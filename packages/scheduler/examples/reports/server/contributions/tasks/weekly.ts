import { defineTask } from '@bitakit/scheduler';
import { z } from 'zod';

export default defineTask({
  input: z.object({ audience: z.string() }),
  execute: async ({ input, signal }) => {
    signal.throwIfAborted();
    // Replace this example result with an authorized business service call.
    return { delivered: input.audience };
  },
});
