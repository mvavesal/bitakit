import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Mark lost',
  visible: ({ input, services }) => {
    const deal = services.deals.board.state.get().deals.find((candidate) => candidate.id === input);
    return Boolean(deal && deal.stage !== 'won' && deal.stage !== 'lost');
  },
  confirm: {
    title: 'Mark this deal as lost?',
    description: 'It leaves the board; the company keeps it in its deals list.',
    destructive: true,
  },
  concurrency: 'per-input',
  execute: ({ services, input }) => services.deals.board.move(input, 'lost'),
  success: 'Deal marked as lost',
});
