/** Runtime-owned lifecycle status, separate from invocation results and custom state. */
export enum ActionStatus {
  Idle = 'idle',
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

/** Custom state is read-only to consumers; updates publish through the existing ActionList. */
export type ActionStateValue<Id extends string> = Id extends keyof import('./types.js').ActionMap
  ? import('./types.js').ActionMap[Id] extends { state: infer State }
    ? Readonly<State>
    : unknown
  : unknown;
