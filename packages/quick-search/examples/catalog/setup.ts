import type { Setup } from '@bitakit/core';
import type { SearchSource } from '@bitakit/quick-search/sources';

// Local demonstration data only. A production source calls its authorized backend with signal.
const lessons = [
  {
    id: 'composition',
    title: 'Composition basics',
    description: 'Build a feature from explicit contracts.',
    href: '/catalog',
  },
  {
    id: 'sources',
    title: 'Search sources',
    description: 'Extend search from your own plugin.',
    href: '/catalog?lesson=sources',
  },
];
const source: SearchSource = {
  title: { key: 'catalog.search.title', fallback: 'Learning catalog' },
  description: {
    key: 'catalog.search.description',
    fallback: 'Find lessons in the local example catalog.',
  },
  category: { id: 'learning', title: { key: 'catalog.search.category', fallback: 'Learning' } },
  defaultEnabled: true,
  search({ query, score }) {
    return lessons.filter((lesson) => !query || score(lesson.title, [lesson.description]) > 0);
  },
  resolve(id) {
    // Re-read current data/access here; do not trust a title or URL stored in history.
    return lessons.find((lesson) => lesson.id === id) ?? null;
  },
};
const setup: Setup = ({ scope }) => {
  // Optional integration: this feature can still run without Quick Search installed.
  if (!scope.slots.has('quick-search.sources')) return;
  const handle = scope.slots.attach(
    { slot: 'quick-search.sources', id: 'lessons', data: source },
    { availability: 'wait' },
  );
  return () => handle.dispose();
};
export default setup;
