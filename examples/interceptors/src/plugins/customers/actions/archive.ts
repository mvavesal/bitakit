import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Archive',
  visible: ({ input, services }) =>
    services.customers.list.state
      .get()
      .customers.some((customer) => customer.id === input && customer.status === 'active'),
  execute: ({ input, services }) => services.customers.list.archive(input),
  success: 'Customer archived',
});
