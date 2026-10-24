import type { Setup } from '@bitakit/core';
import type { SearchResult, SearchSource } from '@bitakit/quick-search/sources';
import type { Note } from './services/list';

const result = (note: Note): SearchResult => ({
  id: String(note.id),
  title: note.title,
  href: '/notes',
});

// Makes notes searchable with Mod+K. Quick Search owns the dialog; this plugin owns its data.
const setup: Setup = ({ scope, services }) => {
  // Optional integration: notes still works in an app without Quick Search.
  if (!scope.slots.has('quick-search.sources')) return;
  const notes = () => services.notes.list.state.get().notes;
  const source: SearchSource = {
    title: 'Notes',
    description: 'Notes you wrote in this session.',
    category: { id: 'notes', title: 'Notes' },
    defaultEnabled: true,
    search: ({ query, score }) =>
      notes()
        .filter((note) => !query || score(note.title) > 0)
        .map(result),
    resolve: (id) => {
      const note = notes().find((note) => String(note.id) === id);
      return note ? result(note) : null;
    },
  };
  const handle = scope.slots.attach(
    { slot: 'quick-search.sources', id: 'notes', data: source },
    { availability: 'wait' },
  );
  return () => handle.dispose();
};
export default setup;
