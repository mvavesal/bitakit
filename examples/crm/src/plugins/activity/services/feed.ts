import { defineService } from '@bitakit/core';

export type Entry = { id: number; text: string; at: string };

// Listens to the other CRM plugins and records what happened during this visit. It changes
// none of them; the listeners end when this plugin stops.
export default defineService(({ store, events }) => {
  const state = store<{ entries: Entry[] }>({ entries: [] });
  let next = 1;
  const record = (text: string) =>
    state.set((current) => ({
      entries: [{ id: next++, text, at: new Date().toISOString() }, ...current.entries].slice(
        0,
        20,
      ),
    }));

  events.on('companies.added', ({ data }) => record(`New company: ${data.name}`));
  events.on('contacts.added', ({ data }) => record(`New contact: ${data.name}`));
  events.on('deals.won', ({ data }) => record(`Deal won: ${data.title}`));
  return { state };
});
