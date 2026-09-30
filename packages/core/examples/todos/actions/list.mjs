import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.list',
  requires: ['todos'],
  execute: ({ services }) => services.todos.list(),
});
