import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.delete',
  requires: ['todos'],
  events: ['todos.changed'],
  setup({ services, action }) {
    action.enabled = services.todos.list().length > 0;
  },
  onEvent(_event, { services, action }) {
    action.enabled = services.todos.list().length > 0;
  },
  execute: ({ services, input }) => services.todos.delete(input),
});
