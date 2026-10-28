import { defineAction } from '@bitakit/core';

export default defineAction<{ companyId: number; title: string; value: number }>({
  title: 'Add deal',
  enabled: ({ input }) => Boolean(input?.title.trim()) && Number(input?.value) > 0,
  execute: ({ services, input }) => services.deals.board.add(input),
  success: ({ input }) => `${input.title} added as a lead`,
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not add the deal.'),
});
