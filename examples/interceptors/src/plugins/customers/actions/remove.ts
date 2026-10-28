import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Remove',
  variant: 'destructive',
  confirm: {
    title: 'Remove this customer?',
    description: 'The customer disappears from the list.',
    destructive: true,
  },
  execute: ({ input, services }) => services.customers.list.remove(input),
  success: 'Customer removed',
});
