import { defineService } from '@bitakit/core';

/** A contact as the API route returns it. */
export type Contact = { id: number; companyId: number; name: string; email: string };

type State = { contacts: Contact[]; status: 'loading' | 'ready' | 'error'; error: string };

/** Throws the server's message, so a failing Action shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

// Contacts stored in SQLite, loaded through src/app/api/contacts/route.ts.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ contacts: [], status: 'loading', error: '' });

  async function load(signal: AbortSignal) {
    try {
      const response = await send('/api/contacts', { signal });
      const { contacts } = (await response.json()) as { contacts: Contact[] };
      state.set({ contacts, status: 'ready', error: '' });
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
    async add(input: { companyId: number; name: string; email: string }) {
      const response = await send('/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const { contact } = (await response.json()) as { contact: Contact };
      state.set((current) => ({ ...current, contacts: [...current.contacts, contact] }));
      events.emit('contacts.added', {
        id: contact.id,
        name: contact.name,
        companyId: contact.companyId,
      });
      return contact;
    },
  };
});
