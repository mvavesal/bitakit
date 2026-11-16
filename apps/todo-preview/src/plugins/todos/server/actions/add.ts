// The operation todos.add. The button in actions/add.ts calls it through services/items.ts with
// remote.todos.add({ title }).
import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';
import { taskList, title } from '../tasks';

export default defineAction({
  access: 'organization',
  expose: true,
  input: z.object({ title }),
  output: taskList,
  execute: ({ input, ctx, services }) => ({ items: services.todos.store.add(ctx, input.title) }),
});
