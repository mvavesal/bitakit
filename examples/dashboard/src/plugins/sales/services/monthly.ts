import { defineService } from '@bitakit/core';

/** Revenue of one month (`2026-10`), in whole euros. */
export type Month = { month: string; revenue: number };

type State = { months: Month[]; status: 'loading' | 'ready' | 'error'; error: string };

// Revenue per month from src/app/api/sales/route.ts. It reloads when the orders plugin
// announces a new order, without that plugin knowing about sales.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ months: [], status: 'loading', error: '' });

  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch('/api/sales', { signal });
      if (!response.ok) throw new Error(await response.text());
      const { months } = (await response.json()) as { months: Month[] };
      state.set({ months, status: 'ready', error: '' });
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  onStart(({ signal }) => {
    void load(signal);
  });
  events.on('orders.created', () => void load());
  return { state };
});
