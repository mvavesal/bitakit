import { defineAction } from '@bitakit/core';
import { z } from 'zod';

// An empty tooltip removes it.
export default defineAction({
  title: 'Set tooltip',
  input: z.string().trim().max(60),
  execute: ({ input, services }) => services.playground.live.set({ tooltip: input }),
});
