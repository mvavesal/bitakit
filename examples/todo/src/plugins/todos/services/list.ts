import { defineService } from '@bitakit/core';

export type Todo = { id: number; title: string; done: boolean };

// The todo list. It lives in memory, so a reload starts empty; call your API here later.
export default defineService(({ store }) => {
  const state = store<{ todos: Todo[] }>({ todos: [] });
  let next = 1;
  const update = (id: number, change: (todo: Todo) => Todo) =>
    state.set((current) => ({
      todos: current.todos.map((todo) => (todo.id === id ? change(todo) : todo)),
    }));
  return {
    state,
    add(title: string) {
      state.set((current) => ({
        todos: [...current.todos, { id: next++, title: title.trim(), done: false }],
      }));
    },
    toggle: (id: number) => update(id, (todo) => ({ ...todo, done: !todo.done })),
    remove(id: number) {
      state.set((current) => ({ todos: current.todos.filter((todo) => todo.id !== id) }));
    },
    clearDone() {
      state.set((current) => ({ todos: current.todos.filter((todo) => !todo.done) }));
    },
  };
});
