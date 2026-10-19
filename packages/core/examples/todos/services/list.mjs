import { defineService } from '@bitakit/core';

/** The Todos data and behavior: an observable store plus the methods that change it. */
export default defineService(({ store, events }) => {
  const state = store({ todos: [], nextId: 1 });

  return {
    state,
    create(title) {
      const todo = { id: state.get().nextId, title, done: false };
      state.set((s) => ({ todos: [...s.todos, todo], nextId: s.nextId + 1 }));
      events.emit('todos.changed', { kind: 'added', id: todo.id });
      return todo;
    },
    all: () => [...state.get().todos],
    delete(id) {
      const before = state.get().todos.length;
      state.set((s) => ({ ...s, todos: s.todos.filter((todo) => todo.id !== id) }));
      const removed = state.get().todos.length < before;
      if (removed) events.emit('todos.changed', { kind: 'removed', id });
      return removed;
    },
  };
});
