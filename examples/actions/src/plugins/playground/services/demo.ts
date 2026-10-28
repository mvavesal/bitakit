import { defineService } from '@bitakit/core';

const fruits = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Pear', 'Plum'];

type State = {
  count: number;
  liked: string[];
  favorite: boolean;
  sort: 'newest' | 'name';
  query: string;
  results: string[];
};

// The playground's state. Actions read it for their titles and rules and change it through
// these methods; the page selects from it with useServiceState.
export default defineService(({ store }) => {
  const state = store<State>({
    count: 0,
    liked: [],
    favorite: false,
    sort: 'newest',
    query: '',
    results: fruits,
  });
  return {
    state,
    increment: () => state.set((current) => ({ ...current, count: current.count + 1 })),
    toggleLike: (name: string) =>
      state.set((current) => ({
        ...current,
        liked: current.liked.includes(name)
          ? current.liked.filter((item) => item !== name)
          : [...current.liked, name],
      })),
    setFavorite: (favorite: boolean) => state.set((current) => ({ ...current, favorite })),
    setSort: (sort: State['sort']) => state.set((current) => ({ ...current, sort })),
    search: (query: string) =>
      state.set((current) => ({
        ...current,
        query,
        results: fruits.filter((fruit) => fruit.toLowerCase().includes(query.toLowerCase())),
      })),
    reset: () =>
      state.set((current) => ({
        ...current,
        count: 0,
        liked: [],
        favorite: false,
        sort: 'newest',
      })),
  };
});
