import { defineAction } from '@bitakit/core';

const find = (todos: { id: number; done: boolean }[], id?: number) =>
  todos.find((todo) => todo.id === id);

export default defineAction<number>({
  // The label follows the row's state: one Action, a different title per todo.
  title: ({ input, services }) =>
    find(services.todos.list.state.get().todos, input)?.done ? 'Undo' : 'Done',
  concurrency: 'per-input',
  execute: ({ services, input }) => services.todos.list.toggle(input),
});
