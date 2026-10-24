import { defineService } from '@bitakit/core';

// Listens to the notes plugin without changing it; the listener ends when this plugin stops.
export default defineService(({ store, events }) => {
  const state = store<{ entries: string[] }>({ entries: [] });
  events.on('notes.changed', ({ data }) => {
    const entry = `${data.kind === 'added' ? 'Added' : 'Removed'} "${data.title}"`;
    state.set((current) => ({ entries: [entry, ...current.entries].slice(0, 5) }));
  });
  return { state };
});
