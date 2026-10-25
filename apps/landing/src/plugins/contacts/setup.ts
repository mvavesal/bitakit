import type { Setup } from '@bitakit/core';
import type { SearchSource } from '@bitakit/quick-search/sources';

// Makes contacts searchable with Mod+K when Quick Search is installed.
const setup: Setup = ({ scope, services }) => {
  if (!scope.slots.has('quick-search.sources')) return;
  const people = () => services.contacts.people.state.get().people;
  const result = (person: { id: number; name: string; company: string }) => ({
    id: String(person.id),
    title: person.name,
    description: person.company,
    href: '/contacts',
  });
  const source: SearchSource = {
    title: { key: 'contacts.search.title', fallback: 'Contacts' },
    description: 'People at your customers.',
    category: { id: 'contacts', title: { key: 'contacts.search.title', fallback: 'Contacts' } },
    defaultEnabled: true,
    search: ({ query, score }) =>
      people()
        .filter((person) => !query || score(`${person.name} ${person.company}`) > 0)
        .map(result),
    resolve: (id) => {
      const person = people().find((entry) => String(entry.id) === id);
      return person ? result(person) : null;
    },
  };
  const handle = scope.slots.attach(
    { slot: 'quick-search.sources', id: 'contacts', data: source },
    { availability: 'wait' },
  );
  return () => handle.dispose();
};
export default setup;
