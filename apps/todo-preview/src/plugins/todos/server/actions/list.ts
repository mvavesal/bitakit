// The operation todos.list: the caller's organization's tasks. services/items.ts calls it with
// remote.todos.list() for the page and the Quick Search source.
import { defineAction } from '@bitakit/core/server';
import { taskList } from '../tasks';

export default defineAction({
  access: 'organization',
  expose: true,
  output: taskList,
  execute: ({ ctx, services }) => ({ items: services.todos.store.list(ctx) }),
});
