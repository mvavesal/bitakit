import { defineService } from '@bitakit/core';

/** The Todos data and behavior: an observable store plus the methods that change it. */
export default defineService(({ store, events }) => {
  const state = store({ items: [], nextId: 1 });

  return {
    state,
    create(title) {
      const task = { id: state.get().nextId, title, done: false };
      state.set((s) => ({ items: [...s.items, task], nextId: s.nextId + 1 }));
      events.emit('todos.changed', { kind: 'added', id: task.id });
      return task;
    },
    list: () => [...state.get().items],
    delete(id) {
      const before = state.get().items.length;
      state.set((s) => ({ ...s, items: s.items.filter((task) => task.id !== id) }));
      const removed = state.get().items.length < before;
      if (removed) events.emit('todos.changed', { kind: 'removed', id });
      return removed;
    },
  };
});
