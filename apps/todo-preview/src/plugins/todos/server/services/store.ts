import { randomUUID } from 'node:crypto';
import { defineService, OperationError, type OrganizationContext } from '@bitakit/core/server';
import type { Task } from '../tasks';

/** The part of an operation's `ctx` the store reads: the verified organization. */
type Scope = Pick<OrganizationContext, 'organization'>;

// On globalThis, so development reloads of the server code keep the preview's tasks.
const preview = globalThis as typeof globalThis & { todoPreviewTasks?: Map<string, Task[]> };

/**
 * The preview's tasks, in memory per organization and lost when the process stops. Every method
 * takes the operation's `ctx` and reads or changes only `ctx.organization.id`'s list; a change
 * answers that whole list. A task ID from another organization is NOT_FOUND.
 */
export default defineService(() => {
  const tasks = (preview.todoPreviewTasks ??= new Map<string, Task[]>());
  const list = (ctx: Scope): Task[] =>
    (tasks.get(ctx.organization.id) ?? []).map((item) => ({ ...item }));
  const change = (ctx: Scope, id: string, update: (item: Task, items: Task[]) => void) => {
    const items = tasks.get(ctx.organization.id) ?? [];
    const item = items.find((entry) => entry.id === id);
    if (!item) throw new OperationError('NOT_FOUND', 'Task not found in this organization.');
    update(item, items);
    return list(ctx);
  };
  return {
    list,
    add(ctx: Scope, title: string) {
      const items = tasks.get(ctx.organization.id) ?? [];
      tasks.set(ctx.organization.id, [...items, { id: randomUUID(), title, completed: false }]);
      return list(ctx);
    },
    edit: (ctx: Scope, id: string, title: string) =>
      change(ctx, id, (item) => {
        item.title = title;
      }),
    complete: (ctx: Scope, id: string, completed: boolean) =>
      change(ctx, id, (item) => {
        item.completed = completed;
      }),
    remove: (ctx: Scope, id: string) =>
      change(ctx, id, (item, items) => items.splice(items.indexOf(item), 1)),
    clear(ctx: Scope) {
      tasks.set(ctx.organization.id, []);
      return list(ctx);
    },
  };
});
