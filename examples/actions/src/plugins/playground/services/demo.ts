import { defineService } from '@bitakit/core';

const fruits = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Pear', 'Plum'];

// The state of the smaller examples: liked fruit and search results. Actions change it through
// these methods; the examples read it with useServiceState.
export default defineService(({ store }) => {
  const state = store({ liked: [] as string[], results: fruits });
  return {
    state,
    toggleLike: (name: string) =>
      state.set((current) => ({
        ...current,
        liked: current.liked.includes(name)
          ? current.liked.filter((item) => item !== name)
          : [...current.liked, name],
      })),
    search: (query: string) =>
      state.set((current) => ({
        ...current,
        results: fruits.filter((fruit) => fruit.toLowerCase().includes(query.toLowerCase())),
      })),
    unlikeAll: () => state.set((current) => ({ ...current, liked: [] })),
  };
});
