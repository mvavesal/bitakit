import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.list',
  execute: ({ services }) => services.todos.list(),
});
