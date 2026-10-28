import { defineService } from '@bitakit/core';

// How many changes the read-only gate stopped during this visit, for the header badge.
export default defineService(({ store }) => {
  const state = store({ count: 0, last: '' });
  return {
    state,
    record: (id: string) => state.set((current) => ({ count: current.count + 1, last: id })),
  };
});
