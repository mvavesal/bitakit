// The operation todos.edit. The button in actions/edit.ts calls it through services/items.ts with
// remote.todos.edit({ id, title }).
import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';
import { taskList, title } from '../tasks';

export default defineAction({
  access: 'organization',
  expose: true,
  input: z.object({ id: z.string(), title }),
  output: taskList,
  execute: ({ input, ctx, services }) => ({
    items: services.todos.store.edit(ctx, input.id, input.title),
  }),
});
