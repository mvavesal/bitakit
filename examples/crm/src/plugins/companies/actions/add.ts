import { defineAction } from '@bitakit/core';

export default defineAction<{ name: string; industry: string }>({
  title: 'Add company',
  enabled: ({ input }) => Boolean(input?.name.trim()),
  execute: ({ services, input }) => services.companies.list.add(input),
  success: ({ input }) => `${input.name} added`,
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not add the company.'),
});
