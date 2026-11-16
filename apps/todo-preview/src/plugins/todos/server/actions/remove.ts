// The operation todos.remove. The button in actions/remove.ts calls it through services/items.ts
// with remote.todos.remove({ id }).
import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';
import { taskList } from '../tasks';

export default defineAction({
  access: 'organization',
  expose: true,
  input: z.object({ id: z.string() }),
  output: taskList,
  execute: ({ input, ctx, services }) => ({ items: services.todos.store.remove(ctx, input.id) }),
});
