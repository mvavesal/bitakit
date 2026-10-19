import { defineAction } from '@bitakit/core';

export default defineAction({
  execute: ({ services }) => services.todos.list.all(),
});
