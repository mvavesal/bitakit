import { defineAction } from '@bitakit/core';
import { z } from 'zod';

// The controls are Actions too, each a few lines: change one field of the state.
export default defineAction({
  title: 'Rename',
  input: z.string().trim().min(1).max(24),
  execute: ({ input, services }) => services.playground.live.set({ title: input }),
});
