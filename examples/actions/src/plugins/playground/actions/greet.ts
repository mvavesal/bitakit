import { defineAction } from '@bitakit/core';
import { z } from 'zod';

// A schema types and checks the input; bound buttons stay disabled while it is invalid.
export default defineAction({
  title: 'Greet',
  input: z.string().trim().min(2),
  execute: () => undefined,
  success: ({ input }) => `Nice to meet you, ${input}!`,
});
