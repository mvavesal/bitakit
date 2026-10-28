import { defineService } from '@bitakit/core';

/** One order as the API route returns it; `total` in whole euros. */
export type Order = {
  id: number;
  product: string;
  quantity: number;
  total: number;
  createdAt: string;
};

type State = {
  thisMonth: number;
  latest: Order[];
  status: 'loading' | 'ready' | 'error';
  error: string;
};

/** Throws the server's message, so a failing Action shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

// This month's orders and the latest five, from src/app/api/orders/route.ts.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ thisMonth: 0, latest: [], status: 'loading', error: '' });

  async function load(signal?: AbortSignal) {
    try {
      const response = await send('/api/orders', { signal });
      const { thisMonth, latest } = (await response.json()) as Pick<State, 'thisMonth' | 'latest'>;
      state.set({ thisMonth, latest, status: 'ready', error: '' });
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  // Startup does not wait for the network; the widget shows `status` while it loads.
  onStart(({ signal }) => {
    void load(signal);
  });

  return {
    state,
    /** Records one sample order on the server, then tells the other plugins. */
    async record() {
      const response = await send('/api/orders', { method: 'POST' });
      const { order } = (await response.json()) as { order: Order };
      await load();
      events.emit('orders.created', { id: order.id, product: order.product, total: order.total });
      return order;
    },
  };
});
