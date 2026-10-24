import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear completed',
  enabled: ({ services }) => services.todos.list.state.get().todos.some((todo) => todo.done),
  confirm: {
    title: 'Delete every completed todo?',
    description: 'This cannot be undone.',
    destructive: true,
  },
  execute: ({ services }) => services.todos.list.clearDone(),
  success: 'Completed todos deleted',
});
