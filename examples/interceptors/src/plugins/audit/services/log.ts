import { defineService } from '@bitakit/core';

/** `action`: an Action completed, `call`: a service method ran, `error`: an Action failed. */
export type Entry = { id: number; kind: 'action' | 'call' | 'error'; text: string; at: string };

// The audit trail of this visit, newest first. Only the interceptors in this plugin write it.
export default defineService(({ store }) => {
  const state = store<{ entries: Entry[] }>({ entries: [] });
  let next = 1;
  return {
    state,
    record(kind: Entry['kind'], text: string) {
      const entry = { id: next++, kind, text, at: new Date().toISOString() };
      state.set((current) => ({ entries: [entry, ...current.entries].slice(0, 50) }));
    },
    clear: () => state.set({ entries: [] }),
  };
});
