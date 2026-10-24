import { defineService } from '@bitakit/core';

export type Note = { id: number; title: string };

// The notes plugin owns its data. Other plugins read this service, listen to `notes.changed`
// or fill the notes slots; none of them edits this folder.
export default defineService(({ store, events, settings }) => {
  const state = store<{ notes: Note[] }>({ notes: [] });
  let next = 1;
  return {
    state,
    add(title: string) {
      const note = { id: next++, title: title.trim() };
      // Read the setting at call time: it may change while the app runs.
      const newestFirst = settings.notes.newestFirst.get();
      state.set((current) => ({
        notes: newestFirst ? [note, ...current.notes] : [...current.notes, note],
      }));
      events.emit('notes.changed', { kind: 'added', title: note.title });
    },
    remove(id: number) {
      const removed = state.get().notes.find((note) => note.id === id);
      state.set((current) => ({ notes: current.notes.filter((note) => note.id !== id) }));
      if (removed) events.emit('notes.changed', { kind: 'removed', title: removed.title });
    },
  };
});
