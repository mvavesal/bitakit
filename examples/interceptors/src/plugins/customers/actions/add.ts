import { defineAction } from '@bitakit/core';
import { z } from 'zod';

export default defineAction({
  title: 'Add customer',
  input: z.string().trim().min(2),
  execute: ({ input, services }) => services.customers.list.add(input),
  success: ({ input }) => `${input} added`,
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not add the customer.'),
});
