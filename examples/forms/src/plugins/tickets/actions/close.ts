import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Close',
  visible: ({ input, services }) =>
    services.tickets.list.state
      .get()
      .tickets.some((ticket) => ticket.id === input && ticket.status === 'open'),
  confirm: {
    title: 'Close this ticket?',
    description: 'It moves to the end of the list and cannot be reopened in this example.',
  },
  concurrency: 'per-input',
  execute: ({ services, input }) => services.tickets.list.close(input),
  success: 'Ticket closed',
});
