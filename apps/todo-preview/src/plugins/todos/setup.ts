import type { Setup } from '@bitakit/core';
import type { SearchSource, SearchResult } from '@bitakit/quick-search/sources';
import ClipboardCheckIcon from 'reicon-react/icons/ClipboardCheck';
import type { Item } from './services/items';

const result = (item: Item): SearchResult => ({
  id: item.id,
  title: item.title,
  href: `/todos#task-${encodeURIComponent(item.id)}`,
});

/** Extend search locally; the existing Todo service and server retain access ownership. */
const setup: Setup = ({ scope, services }) => {
  if (!scope.slots.has('quick-search.sources')) return;
  const source: SearchSource = {
    title: { key: 'todos.search.title', fallback: 'Todos' },
    description: {
      key: 'todos.search.description',
      fallback: 'Tasks in your selected organization.',
    },
    icon: ClipboardCheckIcon,
    category: { id: 'tasks', title: { key: 'todos.search.category', fallback: 'Tasks' } },
    defaultEnabled: true,
    async search({ query, signal, score }) {
      return (await services.todos.items.read(signal))
        .map((item) => ({ item, score: query ? score(item.title) : 1 }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => result(item));
    },
    async resolve(id, { signal }) {
      const item = (await services.todos.items.read(signal)).find((item) => item.id === id);
      return item ? result(item) : null;
    },
  };
  const handle = scope.slots.attach(
    { slot: 'quick-search.sources', id: 'tasks', data: source },
    { availability: 'wait' },
  );
  return () => handle.dispose();
};
export default setup;
