import { defineService } from '@bitakit/core';
import tasks from '../data/tasks.json';

export default defineService(({ store }) => {
  const state = store(tasks);
  return {
    state,
    toggle(id: number) {
      state.set((items) =>
        items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
      );
    },
  };
});
