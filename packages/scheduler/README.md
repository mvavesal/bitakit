# @bitakit/scheduler

UI-free, in-process scheduling for BitaKit. Tasks are executable feature code; schedules and
sources are data. Croner owns cron/date/timezone scheduling in Node and browsers.

Read [AGENTS.md](./AGENTS.md) for the complete package contract, source lifecycle, discovery,
manual server composition and tracing. Runnable examples live in `examples/`; after building,
run `node packages/scheduler/examples/server/main.ts --once` from the repository root.

Source responsibilities: `define.ts` declares tasks/schedules; `discovered.ts` adapts the shared
contribution expansion; `engine.ts` owns execution and reconciliation; `sources.ts` reads data
and URLs; `server/index.ts` reads/watches Node files; `plugin.ts` binds Core lifecycle/events.

This is not a durable queue: no persistence, exactly-once, leader election or closed-tab guarantee.
Install the plugin in the runtime that owns the work; server and browser runtimes are independent.
