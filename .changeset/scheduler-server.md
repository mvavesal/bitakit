---
'@bitakit/scheduler': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
---

The scheduler runs on the server: tasks and schedules are a server-only contribution kind (`server/contributions/tasks|schedules/`) and the package ships a server half, so the generated server file installs the scheduler with them. For one minor version the old place `contributions/tasks|schedules/` keeps running where it ran before (the browser composition), with a warning per file (a kind's new `movedFrom: 'client'` option). `bitakit migrate` moves those files under `server/`: whole kind folders with their data files, dotted and record files, and old root files with a default export; relative imports are adjusted, and other importers and `entries` overrides are reported. Generation refuses one task ID in both the old place and `server/` (it would run twice), and `bitakit doctor` counts an installed package's server half as server content. `@bitakit/scheduler` declares the discovery it needs (optional peer `^0.3.2`).
