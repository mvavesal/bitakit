import { defineAction } from '@bitakit/core';
import { pipeline, type Stage } from '../services/board';

/** The stage after this one, or undefined for won and lost deals. */
const next = (stage: Stage): Stage | undefined => {
  const index = pipeline.indexOf(stage);
  return index === -1 ? undefined : pipeline[index + 1];
};

// Moves a deal one stage to the right; on the last step it is won.
export default defineAction<number>({
  title: ({ input, services }) => {
    const deal = services.deals.board.state.get().deals.find((candidate) => candidate.id === input);
    return deal && next(deal.stage) === 'won' ? 'Mark won' : 'Advance';
  },
  visible: ({ input, services }) => {
    const deal = services.deals.board.state.get().deals.find((candidate) => candidate.id === input);
    return Boolean(deal && next(deal.stage));
  },
  // One pending state per deal, so moving one card does not block the others.
  concurrency: 'per-input',
  execute: ({ services, input }) => {
    const deal = services.deals.board.state.get().deals.find((candidate) => candidate.id === input);
    const stage = deal && next(deal.stage);
    if (!stage) throw new Error('This deal cannot move any further.');
    return services.deals.board.move(input, stage);
  },
});
