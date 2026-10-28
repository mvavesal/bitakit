import { defineService } from '@bitakit/core';

/** A product and how many are left. */
export type Product = { id: number; name: string; stock: number };

type State = { products: Product[]; status: 'loading' | 'ready' | 'error'; error: string };

// Stock levels from src/app/api/inventory/route.ts; reloads when an order takes one out.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ products: [], status: 'loading', error: '' });

  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch('/api/inventory', { signal });
      if (!response.ok) throw new Error(await response.text());
      const { products } = (await response.json()) as { products: Product[] };
      state.set({ products, status: 'ready', error: '' });
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
