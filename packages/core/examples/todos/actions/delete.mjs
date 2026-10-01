import { defineAction } from '@bitakit/core';

export default defineAction({
  id: 'todos.delete',

  // Services this action uses. Core checks that they exist before registering it.
  requires: ['todos'],

  // Initial state: the task list starts empty, so deleting is disabled.
  enabled: false,

  // Events this action reacts to.
  events: ['todos.changed'],

  // Runs each time one of those events is emitted. Core owns the subscription.
  onEvent(_event, { services, action }) {
    action.enabled = services.todos.list().length > 0;
  },

  // Runs when a bound control or your code executes the action.
  execute: ({ services, input }) => services.todos.delete(input),
});
