import { defineService } from '@bitakit/core';

/** A company as the API route returns it. */
export type Company = { id: number; name: string; industry: string };

type State = { companies: Company[]; status: 'loading' | 'ready' | 'error'; error: string };

/** Throws the server's message, so a failing Action shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

// Companies stored in SQLite, loaded through src/app/api/companies/route.ts.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ companies: [], status: 'loading', error: '' });

  async function load(signal: AbortSignal) {
    try {
      const response = await send('/api/companies', { signal });
      const { companies } = (await response.json()) as { companies: Company[] };
      state.set({ companies, status: 'ready', error: '' });
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  // Startup does not wait for the network; pages show `status` while the list loads.
  onStart(({ signal }) => {
    void load(signal);
  });

  return {
    state,
    /** The company with this id, once loaded. */
    find: (id: number) => state.get().companies.find((company) => company.id === id),
    async add(input: { name: string; industry: string }) {
      const response = await send('/api/companies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const { company } = (await response.json()) as { company: Company };
      state.set((current) => ({
        ...current,
        companies: [...current.companies, company].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      // Tell other plugins after the server confirmed the change.
      events.emit('companies.added', { id: company.id, name: company.name });
      return company;
    },
  };
});
