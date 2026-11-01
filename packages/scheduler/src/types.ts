import type {
  ContributionInstallerContext as ContributionContext,
  GeneratedName,
  CheckedName,
  NamedValue,
  InputSchema,
  ServiceContext,
  Store,
} from '@bitakit/core';

/** Discovery augments this map with task definitions. */
export interface TaskMap {}
export interface ScheduleMap {}
export type TaskId = GeneratedName<Extract<keyof TaskMap, string>>;
/** Sources may add IDs at runtime; discovery supplies suggestions, not a closed set. */
export type ScheduleId = Extract<keyof ScheduleMap, string> | (string & {});
export type TaskContext<Input = unknown> = Pick<
  ContributionContext,
  'services' | 'config' | 'events' | 'settings'
> & {
  input: Input;
  signal: AbortSignal;
};
export type TaskDefinition<Input = unknown, Result = unknown> = {
  readonly kind: 'task';
  input?: InputSchema<Input>;
  requires?: readonly string[];
  /** Domain authorization belongs here or in the called service and runs on every invocation. */
  execute(context: TaskContext<Input>): Result | Promise<Result>;
};
export type TaskInput<Id extends string> =
  NamedValue<TaskMap, Id> extends TaskDefinition<infer I, any> ? I : unknown;
export type TaskResult<Id extends string> =
  NamedValue<TaskMap, Id> extends TaskDefinition<any, infer R> ? Awaited<R> : unknown;
export type Schedule = {
  id: string;
  task: string;
  input?: unknown;
  timezone?: string;
  paused?: boolean;
} & ({ cron: string; at?: never } | { at: string; cron?: never });
export type ScheduleOptions =
  | Omit<Extract<Schedule, { cron: string }>, 'id'>
  | Omit<Extract<Schedule, { at: string }>, 'id'>;
export type ScheduleDefinition = ScheduleOptions & { readonly kind: 'schedule' };
export type ScheduleSource = {
  id: string;
  /** Higher wins; equal priorities use case-folded source ID ascending (last wins). */
  priority?: number;
  load(): Promise<readonly Schedule[]>;
  subscribe?(onChange: () => void): () => void;
};
export type SourceRegistration = {
  ready: Promise<void>;
  reload(): Promise<void>;
  /** Immediately revokes the source, then awaits pending loads and restores lower priorities. */
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};
export type ScheduleStatus = Readonly<{
  id: string;
  task: string;
  source: string;
  paused: boolean;
  nextRun: string | null;
}>;
export type SchedulerState = Readonly<{
  running: number;
  schedules: readonly ScheduleStatus[];
  sources: readonly { id: string; failed: boolean }[];
}>;
export type SchedulerNotice = Readonly<{ task: string; schedule?: string; runId: number }>;
export type RunOptions = { schedule?: string };
export interface Scheduler {
  readonly state: Store<SchedulerState>;
  registerTask<Input, Result>(
    id: string,
    task: TaskDefinition<Input, Result>,
    context?: Pick<ContributionContext, 'services' | 'config' | 'events' | 'settings'>,
  ): () => Promise<void>;
  registerSource(source: ScheduleSource): SourceRegistration;
  reload(id?: string): Promise<void>;
  unregisterSource(id: string): Promise<void>;
  registerSchedule(schedule: Schedule, options?: { priority?: number }): SourceRegistration;
  run<const Id extends string>(
    id: Id & CheckedName<Id, Extract<keyof TaskMap, string>>,
    input?: TaskInput<Id>,
    options?: RunOptions,
  ): Promise<TaskResult<Id>>;
  pause(id: ScheduleId): void;
  resume(id: ScheduleId): void;
  list(): readonly ScheduleStatus[];
}
export type SchedulerContext = Pick<
  ServiceContext,
  'services' | 'config' | 'events' | 'settings' | 'store'
>;
