import { defineAction } from '@bitakit/core';
import { ticketSchema } from '../schema';

// The schema types the input and checks it before `execute` runs. The dialog's form calls this
// Action with the values it already validated against the same schema.
export default defineAction({
  title: 'Create ticket',
  input: ticketSchema,
  execute: ({ services, input }) => services.tickets.list.create(input),
  success: 'Ticket created',
});
