import { z } from 'zod';

/**
 * What a new ticket needs. One schema for the form (field messages), the tickets.create
 * Action (`input`) and the API route (the server checks again): the rules live in one place.
 */
export const ticketSchema = z.object({
  title: z.string().trim().min(5, 'Use at least 5 characters.'),
  email: z.email('Enter an email address such as ada@example.com.'),
  priority: z.enum(['low', 'normal', 'high']),
  description: z.string().trim().min(20, 'Describe the problem in at least 20 characters.'),
});

export type NewTicket = z.infer<typeof ticketSchema>;
