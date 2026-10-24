import { defineService } from '@bitakit/core';

export default defineService(({ store }) => {
  const state = store({ count: 0 });
  return {
    state,
    increment: () => state.set((s) => ({ count: s.count + 1 })),
    reset: () => state.set({ count: 0 }),
  };
});
