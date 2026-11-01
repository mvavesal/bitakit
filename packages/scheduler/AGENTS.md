# @bitakit/scheduler consumer guide

This guide is for using the package. Changes to the package follow the repository root rules.

## Composition and ownership

Install the optional package in the runtime that owns scheduled work. It has no React or UI
imports. Discovery's package metadata installs its zero-argument default plugin factory;
manual hosts use the named `schedulerPlugin` with `createRuntime`. The plugin ID is `scheduler`,
the service ID is `scheduler-engine`, and the shared contract is `scheduler`:

```ts
import { getService } from '@bitakit/core';
import { scheduler } from '@bitakit/scheduler';
const jobs = getService(services, scheduler);
await jobs.run('reports.weekly', { audience: 'team' });
```

No server generator exists yet. Use explicit server composition as in `examples/server/main.ts`.
Never import `@bitakit/scheduler/server` into browser code. Install the scheduler once per
runtime; installing it on both server and browser executes two independent sets of jobs.

## Tasks and default schedules

A feature declares executable code with `defineTask({ input?, requires?, execute })` in
`contributions/tasks/weekly.ts`. The execute context contains `services`, plugin-owned `config`,
`events`, `settings`, parsed `input` and `signal`. `input` accepts Core's Zod/Standard Schema
contract; `requires` checks available services at registration and each execution. Domain
permissions belong in the task or the called business service and must be checked on every run.
UI Actions are callers, not task definitions. Never load executable code from a schedule source.

Use `defineSchedule({ task, cron, input?, timezone?, paused? })` or `{ task, at, ... }` in
`contributions/schedules/weekly.ts`. `at` is an ISO datetime with an explicit UTC offset.
[Croner](https://croner.56k.guru/usage/configuration/) validates cron patterns and IANA timezones. Croner 11 supports Node >=18 and browsers;
the repository and example runner use Node 24. No custom cron syntax or parser is added.

IDs derive from plugin + file: `reports.weekly` in two separate namespaces. Folder, dotted
(`contributions/tasks.weekly.ts`) and record (`contributions/tasks.ts` exporting `{ weekly }`)
forms are equivalent. Generated `TaskMap` checks task string arguments and inputs;
`ScheduleMap` supplies known schedule IDs. Schedule APIs also accept runtime source IDs.
Registration IDs must be unique ignoring case in this new package; source snapshots also reject
case-only duplicate schedule IDs. Lookups and external task references ignore case. Existing
Core names retain their exact spellings and exact-match precedence.

Manual composition uses `registerTask(id, definition, context?)`, returning an async cleanup
function. Pass the feature's context for ownership, rather than the scheduler's context, when
emitting that feature's events. Discovery installers supply that context automatically.
A host may also call `createScheduler(context)` directly, then await `start()`/`stop()`; use the
ordinary plugin when Core service interception and runtime ownership are needed.

## Schedule sources

`registerSource({ id, priority?, load, subscribe? })` is the one source contract. `load()` returns
an entire `Promise<readonly Schedule[]>`; each schedule adds `id` to the fields above.
`subscribe(onChange)` optionally returns a synchronous unsubscribe function. Notifications
request serialized reloads; they do not carry deltas. No separate adapter registry exists.

The returned handle has `ready`, `reload()`, `dispose()` and `[Symbol.asyncDispose]()`. Register
in a normal service's `onStart`, immediately own disposal with `onStop`, then await `ready`.
Initial errors reject `ready`/startup; later errors reject explicit reload and report through
the scheduler's local error handler (console by default), with a sanitized `failed` source
flag in the store. Invalid snapshots retain the previous valid snapshot. Unsubscribe and revoke
happen before waiting for an in-flight load; an old load cannot restore a removed source.
Loads must settle: the source contract does not forcibly cancel provider I/O.

Higher priority wins. Defaults use -100; sources default to 0; `registerSchedule` uses 100.
Equal priority sorts source IDs by case-folded code-point order, with the last source winning.
Schedule IDs are case-insensitive. Removing an override restores its lower-priority default.
Unchanged effective definitions keep their Croner instance, including completed one-shot state.
`pause(scheduleId)`/`resume(scheduleId)` are runtime overrides retained through source refresh.
Removed schedules stop their timers; already-running calls finish normally unless their task
or the entire scheduler is disposed. No ongoing run is silently restarted by a reload.

Built-ins:

- `dataSource({ id, load, subscribe?, priority? })` accepts an ordinary data callback.
- `urlSource({ id, url, format?: 'json' | 'yaml', fetch?, subscribe?, priority? })` fetches at
  registration and reload, with `cache: 'no-store'`. Supply authenticated fetch as needed.
- `fileSource({ id, path, format?, watch?, priority? })` from `@bitakit/scheduler/server` reads
  at runtime and watches the containing directory for atomic replacement. `watch: false`
  means explicit reload. File watcher errors remain observable through a failed reload.

JSON/YAML documents are arrays, not code or build imports. Use JSON-compatible task input.
`parseSchedules` and `parseScheduleDocument` expose the same Zod/YAML parsing used by sources.
A DB/CMS adapter is an ordinary authorized server service, for example:

```ts
const registration = jobs.registerSource({
  id: 'tenant-db',
  priority: 20,
  load: async () => parseSchedules(await database.readAuthorizedSchedules()),
  subscribe: (reload) => database.subscribeToScheduleChanges(reload),
});
onStop(() => registration.dispose());
await registration.ready;
```

`database` here is the host's existing provider, not an included CMS/DB integration. Access
control and trusted tenant selection belong to that provider. Browser clients use data/URL
sources and must not receive server credentials.

## Execution, observation and cleanup

`run(taskId, input?, { schedule? }?)` executes and returns the task result. `schedule` is
correlation metadata, never proof of authorization. `reload(sourceId?)`, `unregisterSource(id)`,
`registerSchedule(schedule, { priority? }?)`, `pause`, `resume` and `list` manage schedules.
`state` is Core's observable service store: running count, schedule status/next run, and source
failure flags. It excludes task input/results and raw errors. No history/database is maintained.

Croner protects each schedule from overlapping itself. Manual runs and different schedules
may overlap. Every automatic callback re-enters the decorated public `scheduler.run` service,
so existing Core service interceptors see automatic, manual and event-triggered calls once.
Use `defineInterceptor({ service: 'scheduler', method: 'run', before, after, onError })` as in
`examples/audit/plugin.ts`. Service interceptors are already cross-plugin; unlike Action
interceptors they do not accept a `scope: 'global'` option. `callId` correlates phases within
one runtime, `startedAt` is epoch milliseconds, and `durationMs` measures through settlement.
Observers may call their own DB/file logging service. Hooks do not block execution and do not
promise durable logging. Interceptors are trusted code and see arguments/results; redact there.

Existing events `scheduler.started`, `scheduler.completed`, `scheduler.failed` contain only
`task`, optional `schedule` and a runtime-local `runId`. Failed validation emits `failed` without
`started`. These events use Core's bus and normal listener ownership. `runId` and interceptor
`callId` are separate local correlation domains. Event-triggered tasks call `jobs.run` and await
or handle its promise. A task may emit only its own feature's declared events.

The plugin gates execution on Core runtime readiness; timers do not run during incomplete startup.
Task removal aborts and drains its jobs. Runtime stop stops timers, revokes/unsubscribes all
sources, aborts jobs and awaits their settlement; it is idempotent. Tasks must cooperate with
AbortSignal. Never await scheduler/task/runtime cleanup from one of its own running tasks:
that would wait for itself. Source errors do not erase valid schedules; task failures reject
manual calls and are reported for automatic runs. There is no persistence, missed-run catch-up,
exactly-once, distributed locking, leader election, or execution while a browser tab is closed.

## Verification

From the repository: build Core, then `npm run test --workspace @bitakit/scheduler`;
`tsc -p packages/scheduler/examples/tsconfig.json`; run the server example with `--once`.
Tests cover source precedence, invalid/stale snapshots, cleanup, feature ownership, input
validation, timer execution and one public interceptor trace per run. Test a real installed
consumer's generated type maps when changing contribution metadata. Keep this guide and the
reference page aligned with shipped behavior; `CLAUDE.md` only imports this file.
