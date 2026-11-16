import { z } from 'zod';

// Shared by the store and the operations; a plain server file, so discovery skips it.

/** One task, as every operation returns it. */
export const task = z.object({ id: z.string(), title: z.string(), completed: z.boolean() });
export type Task = z.infer<typeof task>;

/** What every operation answers: the organization's whole list after the change. */
export const taskList = z.object({ items: z.array(task) });

/** A task title: trimmed, never empty. */
export const title = z.string().trim().min(1);
