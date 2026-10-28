import { defineService } from '@bitakit/core';

export type Stage = 'lead' | 'qualified' | 'proposal' | 'won' | 'lost';

/** A deal as the API route returns it; `value` in whole euros. */
export type Deal = { id: number; companyId: number; title: string; value: number; stage: Stage };

/** The open stages in order; a deal moves right until it is won. */
export const pipeline: readonly Stage[] = ['lead', 'qualified', 'proposal', 'won'];

type State = { deals: Deal[]; status: 'loading' | 'ready' | 'error'; error: string };

/** Throws the server's message, so a failing Action shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

const json = (body: unknown): RequestInit => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// The pipeline stored in SQLite, loaded through src/app/api/deals/route.ts.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ deals: [], status: 'loading', error: '' });

  async function load(signal: AbortSignal) {
    try {
      const response = await send('/api/deals', { signal });
      const { deals } = (await response.json()) as { deals: Deal[] };
      state.set({ deals, status: 'ready', error: '' });
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  /** Replaces one deal in the store with the server's copy. */
  function put(deal: Deal) {
    state.set((current) => ({
      ...current,
      deals: current.deals.map((existing) => (existing.id === deal.id ? deal : existing)),
    }));
  }

  // Startup does not wait for the network; pages show `status` while the board loads.
  onStart(({ signal }) => {
    void load(signal);
  });

  return {
    state,
    async add(input: { companyId: number; title: string; value: number }) {
      const response = await send('/api/deals', { method: 'POST', ...json(input) });
      const { deal } = (await response.json()) as { deal: Deal };
      state.set((current) => ({ ...current, deals: [deal, ...current.deals] }));
      return deal;
    },
    async move(id: number, stage: Stage) {
      const response = await send('/api/deals', { method: 'PATCH', ...json({ id, stage }) });
      const { deal } = (await response.json()) as { deal: Deal };
      put(deal);
      if (stage === 'won') events.emit('deals.won', { id, title: deal.title, value: deal.value });
      return deal;
    },
  };
});
