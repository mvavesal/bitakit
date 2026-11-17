// The operation todos.complete. The button in actions/complete.ts calls it through
// services/items.ts with remote.todos.complete({ id, completed }).
import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';
import { taskList } from '../tasks';

export default defineAction({
  access: 'organization',
  expose: true,
  input: z.object({ id: z.string(), completed: z.boolean() }),
  output: taskList,
  execute: ({ input, ctx, services }) => ({
    items: services.todos.store.complete(ctx, input.id, input.completed),
  }),
});
