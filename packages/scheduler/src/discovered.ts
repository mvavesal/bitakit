import { expandContributions, type DiscoveredFile } from '@bitakit/core';
import type { TaskDefinition, Schedule, ScheduleDefinition } from './types.js';

export type DiscoveredTask = { id: string; definition: TaskDefinition<any, any> };
const kind = (value: unknown, expected: string) =>
  !!value && typeof value === 'object' && 'kind' in value && value.kind === expected;
export function discoverTasks(files: readonly DiscoveredFile[], module = ''): DiscoveredTask[] {
  return expandContributions(files, (value) => kind(value, 'task')).map(({ value, path }) => ({
    id: [module, ...path].filter(Boolean).join('.'),
    definition: value,
  }));
}
export function discoverSchedules(files: readonly DiscoveredFile[], module = ''): Schedule[] {
  return expandContributions(files, (value) => kind(value, 'schedule')).map(({ value, path }) => {
    const { kind: _kind, ...schedule } = value as ScheduleDefinition;
    return { ...schedule, id: [module, ...path].filter(Boolean).join('.') } as Schedule;
  });
}
type Join<A extends string, B extends string> = A extends '' ? B : B extends '' ? A : `${A}.${B}`;
type Intersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;
type Entries<V, P extends string, Kind extends string> = [V] extends [{ kind: Kind }]
  ? { [K in P]: V }
  : V extends object
    ? Intersection<
        { [K in Extract<keyof V, string>]: Entries<V[K], Join<P, K>, Kind> }[Extract<
          keyof V,
          string
        >]
      >
    : {};
export type TaskEntry<F, Module extends string> =
  F extends DiscoveredFile<infer V, infer P> ? Entries<V, Join<Module, P>, 'task'> : {};
export type ScheduleEntry<F, Module extends string> =
  F extends DiscoveredFile<infer V, infer P> ? Entries<V, Join<Module, P>, 'schedule'> : {};
