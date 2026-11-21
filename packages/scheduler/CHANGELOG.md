# @bitakit/scheduler

## 0.3.3

### Patch Changes

- c4cb802: `runDue({ now?, within? })` runs every enabled, unpaused schedule (code and source schedules alike) whose latest slot, at or before `now` in its timezone, lies in `(now - within, now]` (`within` in milliseconds, default 60000), once each through the public `run`, and resolves with one settled entry per due schedule (`fulfilled`, `rejected`, or `skipped` while its previous run is still in progress in this process). A host's cron calls it from a route, so schedules run on serverless hosts where no process keeps the timers alive. Tasks now receive `schedule` and `slot` (the planned time as a `Date`) in their context for timer runs, `runDue` and a caller's new `run(…, { slot })` option, so a task can claim each slot once; deduplication across instances stays the task's job. A schedule never overlaps itself in one process across timers and `runDue`.

## 0.3.2

### Patch Changes

- 2fd4654: The scheduler runs on the server: tasks and schedules are a server-only contribution kind (`server/contributions/tasks|schedules/`) and the package ships a server half, so the generated server file installs the scheduler with them. For one minor version the old place `contributions/tasks|schedules/` keeps running where it ran before (the browser composition), with a warning per file (a kind's new `movedFrom: 'client'` option). `bitakit migrate` moves those files under `server/`: whole kind folders with their data files, dotted and record files, and old root files with a default export; relative imports are adjusted, and other importers and `entries` overrides are reported. Generation refuses one task ID in both the old place and `server/` (it would run twice), and `bitakit doctor` counts an installed package's server half as server content. `@bitakit/scheduler` declares the discovery it needs (optional peer `^0.3.2`).
- Updated dependencies [e4e9440]
- Updated dependencies [a8f1ce8]
- Updated dependencies [636efcb]
- Updated dependencies [d113780]
- Updated dependencies [ab106bc]
- Updated dependencies [faa7969]
- Updated dependencies [70d0d5c]
  - @bitakit/core@0.3.3

## 0.3.1

### Patch Changes

- 40e8687: The agent guide says where task files go now that apps have a server half: keep them in `contributions/tasks/`; a task under `server/contributions/tasks/` is a generation error until tasks become a server-only kind.
- Updated dependencies [40e8687]
  - @bitakit/core@0.3.2

## 0.3.0

### Minor Changes

- df00bdd: Start the 0.3 release line: roles and permissions as configuration.

  Plugins declare the resources and operations they own in `permissions.ts` (`definePermissions`); the app declares its base roles once in `src/roles.ts` (`defineRoles`, with `standard`, `label`, `description`, `grants` and the `customRoles` option). Discovery collects both, types role grants against the discovered catalog (`PermissionMap`, `RoleMap`) and, like the runtime start, rejects a resource declared twice, grants of unknown resources or operations, a standard role extended twice and roles outside the app. Core only owns this vocabulary; the authorization provider translates it and decides every check. `@bitakit/organizations` gets the provider-independent role contract: backends report the organization's roles (base and custom, with permissions for presentation) and the viewer's permissions; invitations and role changes take role IDs; custom roles and the invitation domain policy are optional backend capabilities, and `normalizeInvitationDomain` is the one domain check that settings screens and providers share. The service offers assignable roles for choices only; the provider enforces every rule on the server.

### Patch Changes

- Updated dependencies [df00bdd]
  - @bitakit/core@0.3.0

## 0.2.1

### Patch Changes

- 3917b35: Add the optional UI-free scheduler with task contributions, runtime schedule sources, Croner
  execution and awaited cleanup. Extend integration installers with their owner's execution
  context and export the shared contribution expander. Add exact-first, unambiguous
  case-insensitive identifier resolution without renaming existing declarations or stored keys.
  Service observers expose per-call correlation and duration through async settlement.
- c84b956: Remove bundled package cover artwork and its package metadata and exports.
- Updated dependencies [3917b35]
- Updated dependencies [c84b956]
  - @bitakit/core@0.2.9
