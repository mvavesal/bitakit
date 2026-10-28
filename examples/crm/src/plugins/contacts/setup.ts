import type { Setup } from '@bitakit/core';
import type { SearchResult, SearchSource } from '@bitakit/quick-search/sources';
import type { Contact } from './services/list';

const result = (contact: Contact): SearchResult => ({
  id: String(contact.id),
  title: contact.name,
  description: contact.email,
  href: `/companies/${contact.companyId}`,
});

// Makes contacts searchable with Mod+K. Quick Search owns the dialog; this plugin owns its data.
const setup: Setup = ({ scope, services }) => {
  // Optional integration: contacts still works in an app without Quick Search.
  if (!scope.slots.has('quick-search.sources')) return;
  const contacts = () => services.contacts.list.state.get().contacts;
  const source: SearchSource = {
    title: 'Contacts',
    description: 'People at your companies.',
    category: { id: 'contacts', title: 'Contacts' },
    defaultEnabled: true,
    search: ({ query, score }) =>
      contacts()
        .filter((contact) => !query || score(`${contact.name} ${contact.email}`) > 0)
        .map(result),
    resolve: (id) => {
      const contact = contacts().find((candidate) => String(candidate.id) === id);
      return contact ? result(contact) : null;
    },
  };
  const handle = scope.slots.attach(
    { slot: 'quick-search.sources', id: 'contacts', data: source },
    { availability: 'wait' },
  );
  return () => handle.dispose();
};
export default setup;
