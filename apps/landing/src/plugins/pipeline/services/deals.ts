import { defineService } from '@bitakit/core';
import sampleDeals from '../data/deals.json';
import newDeals from '../data/new-deals.json';
import sampleLastQuarter from '../data/last-quarter.json';

export type Stage = 'lead' | 'qualified' | 'demo' | 'proposal' | 'negotiation' | 'won';
export type Deal = { id: number; name: string; company: string; amount: number; stage: Stage };

export const stages: Stage[] = ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'won'];

/** Deal value per stage last quarter, for comparison (sample data). */
export const lastQuarter = sampleLastQuarter as Record<Stage, number>;

// The deals of the pipeline. Other plugins read this service or listen to its events.
export default defineService(({ store, events }) => {
  const state = store<{ deals: Deal[] }>({
    deals: sampleDeals.map((deal, index) => ({
      ...deal,
      stage: deal.stage as Stage,
      id: index + 1,
    })),
  });
  let next = sampleDeals.length + 1;
  const find = (id: number) => state.get().deals.find((deal) => deal.id === id);
  return {
    state,
    find,
    add() {
      // The next sample deal from data/new-deals.json, as a new lead.
      const deal: Deal = { ...newDeals[next % newDeals.length], id: next++, stage: 'lead' };
      state.set((current) => ({ deals: [deal, ...current.deals] }));
      events.emit('pipeline.added', { name: `${deal.company}: ${deal.name}`, amount: deal.amount });
    },
    win(id: number) {
      const deal = find(id);
      if (!deal) return;
      state.set((current) => ({
        deals: current.deals.map((entry) => (entry.id === id ? { ...entry, stage: 'won' } : entry)),
      }));
      events.emit('pipeline.won', { name: `${deal.company}: ${deal.name}`, amount: deal.amount });
    },
    remove(id: number) {
      const deal = find(id);
      state.set((current) => ({ deals: current.deals.filter((entry) => entry.id !== id) }));
      if (deal) events.emit('pipeline.removed', { name: `${deal.company}: ${deal.name}` });
    },
  };
});
