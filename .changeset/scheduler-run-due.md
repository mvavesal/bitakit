---
'@bitakit/scheduler': patch
---

`runDue({ now?, within? })` runs every enabled, unpaused schedule (code and source schedules alike) whose latest slot, at or before `now` in its timezone, lies in `(now - within, now]` (`within` in milliseconds, default 60000), once each through the public `run`, and resolves with one settled entry per due schedule (`fulfilled`, `rejected`, or `skipped` while its previous run is still in progress in this process). A host's cron calls it from a route, so schedules run on serverless hosts where no process keeps the timers alive. Tasks now receive `schedule` and `slot` (the planned time as a `Date`) in their context for timer runs, `runDue` and a caller's new `run(…, { slot })` option, so a task can claim each slot once; deduplication across instances stays the task's job. A schedule never overlaps itself in one process across timers and `runDue`.
