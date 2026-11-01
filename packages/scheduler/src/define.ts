import type { InputSchema } from '@bitakit/core';
import type { ScheduleOptions, TaskDefinition } from './types.js';

export function defineTask<I, R>(
  definition: Omit<TaskDefinition<I, R>, 'kind'> & { input: InputSchema<I> },
): TaskDefinition<I, R>;
export function defineTask<I = unknown, R = unknown>(
  definition: Omit<TaskDefinition<I, R>, 'kind'>,
): TaskDefinition<I, R>;
export function defineTask(
  definition: Omit<TaskDefinition<any, any>, 'kind'>,
): TaskDefinition<any, any> {
  return { ...definition, kind: 'task' };
}
export function defineSchedule<const T extends ScheduleOptions>(
  definition: T,
): T & { readonly kind: 'schedule' } {
  return { ...definition, kind: 'schedule' };
}
