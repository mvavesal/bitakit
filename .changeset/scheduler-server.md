---
'@bitakit/scheduler': patch
'@bitakit/discovery': patch
---

The scheduler runs on the server: tasks and schedules are a server-only contribution kind (`server/contributions/tasks|schedules/`) and the package ships a server half, so the generated server file installs the scheduler with them. For one minor version the server still reads the old place `contributions/tasks|schedules/` with a warning (a kind's new `movedFrom: 'client'` option), the browser ignores it, and `bitakit migrate` moves those files with their relative imports adjusted.
