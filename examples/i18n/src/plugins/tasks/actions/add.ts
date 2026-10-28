import { defineAction } from '@bitakit/core';
import { z } from 'zod';

// Titles and messages here are the English fallbacks. The catalog keys `tasks.add.title` and
// `tasks.add.success` translate them; `values` fill the placeholders of the message.
export default defineAction({
  title: 'Add task',
  input: z.string().trim().min(1),
  execute: ({ input, services }) => services.tasks.list.add(input),
  success: ({ input }) => ({ message: `Added "${input}"`, values: { title: input } }),
});
