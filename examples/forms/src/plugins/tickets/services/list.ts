import { defineService } from '@bitakit/core';
import type { NewTicket } from '../schema';

/** A ticket as the API route returns it. */
export type Ticket = NewTicket & { id: number; status: 'open' | 'closed'; createdAt: string };

type State = { tickets: Ticket[]; status: 'loading' | 'ready' | 'error'; error: string };

/** Throws the server's message, so a failing Action or form shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

const json = (body: unknown): RequestInit => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// Tickets stored in SQLite, through src/app/api/tickets/route.ts.
export default defineService(({ store, onStart }) => {
  const state = store<State>({ tickets: [], status: 'loading', error: '' });

  async function load(signal: AbortSignal) {
    try {
      const response = await send('/api/tickets', { signal });
      const { tickets } = (await response.json()) as { tickets: Ticket[] };
      state.set({ tickets, status: 'ready', error: '' });
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  // Startup does not wait for the network; the page shows `status` while the list loads.
  onStart(({ signal }) => {
    void load(signal);
  });

  /** Puts the server's copy of a ticket into the list. */
  function put(ticket: Ticket) {
    state.set((current) => ({
      ...current,
      tickets: [ticket, ...current.tickets.filter((existing) => existing.id !== ticket.id)],
    }));
  }

  return {
    state,
    async create(ticket: NewTicket) {
      const response = await send('/api/tickets', { method: 'POST', ...json(ticket) });
      put(((await response.json()) as { ticket: Ticket }).ticket);
    },
    async close(id: number) {
      const response = await send('/api/tickets', { method: 'PATCH', ...json({ id }) });
      put(((await response.json()) as { ticket: Ticket }).ticket);
    },
  };
});
