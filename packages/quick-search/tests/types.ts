import type { Setup, SlotData } from '@bitakit/core';
import type { SearchSource } from '../src/sources.js';
import setup from '../examples/catalog/setup.js';
const checked: Setup = setup;
const data: SlotData<'quick-search.sources'> = {
  title: 'Courses',
  description: 'Accessible courses',
  category: { id: 'learning', title: 'Learning' },
  defaultEnabled: false,
  search: async ({ signal }) => {
    signal.throwIfAborted();
    return [{ id: 'intro', href: '/courses/intro', title: 'Introduction' }];
  },
  resolve: async (id) => ({ id, href: '/courses/intro', title: 'Introduction' }),
} satisfies SearchSource;
const bad: Setup = ({ scope }) => {
  // @ts-expect-error A source needs search and resolve behavior, not just a label.
  scope.slots.attach({ slot: 'quick-search.sources', id: 'broken', data: { title: 'Broken' } });
};
void [checked, data, bad];
