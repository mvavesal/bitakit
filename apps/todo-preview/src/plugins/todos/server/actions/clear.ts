// The operation todos.clear. The button in actions/clear.ts asks for confirmation; the service
// sends the organization the person confirmed, and nothing is cleared when the session has moved
// to another organization since.
import { defineAction, OperationError } from '@bitakit/core/server';
import { z } from 'zod';
import { taskList } from '../tasks';

export default defineAction({
  access: 'organization',
  expose: true,
  input: z.object({ organizationId: z.string() }),
  output: taskList,
  execute: ({ input, ctx, services }) => {
    if (input.organizationId !== ctx.organization.id)
      throw new OperationError('CONFLICT', 'The selected organization changed. Try again.');
    return { items: services.todos.store.clear(ctx) };
  },
});
