import { defineAction } from '@bitakit/core';

export default defineAction<{ companyId: number; name: string; email: string }>({
  title: 'Add contact',
  enabled: ({ input }) => Boolean(input?.name.trim() && input.email.includes('@')),
  execute: ({ services, input }) => services.contacts.list.add(input),
  success: ({ input }) => `${input.name} added`,
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not add the contact.'),
});
