# @bitakit/discovery

## 0.3.2

### Patch Changes

- e4e9440: Server Actions take `type: 'query' | 'mutation'` (default mutation), and `server.operations()` describes each operation's `type` and, where the schema implements Standard JSON Schema (zod 4), its `input` and `output` as JSON Schema (draft 2020-12) – the descriptions transport adapters and OpenAPI documents are built from.
- 636efcb: Packages ship server halves: `bitakit build` writes `dist/server.js`, `dist/server.d.ts` and `dist/server.json` for a package's `server/` folder (and the browser entry now carries its `installers/`); a package declares it with `bitakit.server`, and an app's generated server file loads it. The app decides which package operations go over HTTP with `server.publish` in `bitakit.config.ts` (`ServerOptions.publish`); installing a package never adds endpoints by itself. The CSS audit skips the server entry.
- d113780: A discovered plugin can install a contribution kind from a file: `installers/<kind>.ts` (browser) or `server/installers/<kind>.ts` (server), default-exporting `defineInstaller<'<kind>'>(…)`. Discovery turns them into the plugin's `installs`; `bitakit add installer <plugin>/<kind> [--server]` writes one.
- 2fd4654: The scheduler runs on the server: tasks and schedules are a server-only contribution kind (`server/contributions/tasks|schedules/`) and the package ships a server half, so the generated server file installs the scheduler with them. For one minor version the old place `contributions/tasks|schedules/` keeps running where it ran before (the browser composition), with a warning per file (a kind's new `movedFrom: 'client'` option). `bitakit migrate` moves those files under `server/`: whole kind folders with their data files, dotted and record files, and old root files with a default export; relative imports are adjusted, and other importers and `entries` overrides are reported. Generation refuses one task ID in both the old place and `server/` (it would run twice), and `bitakit doctor` counts an installed package's server half as server content. `@bitakit/scheduler` declares the discovery it needs (optional peer `^0.3.2`).
- ab106bc: The generated server takes its rate limits from `bitakit.config.ts` (`server.rateLimit: { limit?, windowMs? } | false`, checked at generation). Who the client is and a shared store are code: a server service that provides the new `rateLimit` contract (`@bitakit/core/server`) supplies `key` and `store`; options passed to `createServer` win over it. A server now drains a public call that is still waiting in an async rate-limit store before it stops. The app skill and the server docs now describe the built-in rate limit, CORS for trusted origins and the transport packages.
- 70d0d5c: Server services may read `services` in their own factory without writing a return type. `ServerServices` is an interface over a lazily resolved namespace, and discovery writes the key of each one-service file itself (`DiscoveredServiceValue`), so the discovered map no longer waits for the file it describes.
- 74a2b30: A disabled plugin keeps its typed names. The generated files reference its services, server services, actions, events, settings, configs, slots and (beside enabled ones) permissions only through type-only `typeof import(…)` entries, so its own files and optional references from other plugins still compile while nothing of it is imported, checked or run. A name an enabled module also claims stays the enabled module's (`Omit` over the switched-off entries). Its slot definitions declare no slot, its server Actions stay unchecked and untyped, and the integration kinds' type maps keep only enabled plugins.
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

- 40e8687: Discovery reads plugins' `server/` folders (`server/actions`, `server/services`, `server/interceptors` and `server/contributions/<directory>`) and writes `src/bitakit.gen.server.ts` while a module has server content, with `remote` in the client config for the exposed operations; it removes the file again when the server content is gone. Contribution kinds may declare `runtime: 'client' | 'server' | 'both'`, and a file on the wrong side is a generation error naming where it belongs (a task under `server/contributions/tasks/`, ignored before, is now such an error). Generation also rejects client-only fields, a missing `access` and reserved names in server Actions, and `access`, `expose` or `output` in client Actions. `bitakit.config.ts` accepts `server: { endpoint }`, and `describeModule`/`describeBitaKit` report each module's server files. Server content needs `@bitakit/core` 0.3.2 or later.
- Updated dependencies [40e8687]
  - @bitakit/core@0.3.2

## 0.3.0

### Minor Changes

- df00bdd: Start the 0.3 release line: roles and permissions as configuration.

  Plugins declare the resources and operations they own in `permissions.ts` (`definePermissions`); the app declares its base roles once in `src/roles.ts` (`defineRoles`, with `standard`, `label`, `description`, `grants` and the `customRoles` option). Discovery collects both, types role grants against the discovered catalog (`PermissionMap`, `RoleMap`) and, like the runtime start, rejects a resource declared twice, grants of unknown resources or operations, a standard role extended twice and roles outside the app. Core only owns this vocabulary; the authorization provider translates it and decides every check. `@bitakit/organizations` gets the provider-independent role contract: backends report the organization's roles (base and custom, with permissions for presentation) and the viewer's permissions; invitations and role changes take role IDs; custom roles and the invitation domain policy are optional backend capabilities, and `normalizeInvitationDomain` is the one domain check that settings screens and providers share. The service offers assignable roles for choices only; the provider enforces every rule on the server.

### Patch Changes

- Updated dependencies [df00bdd]
  - @bitakit/core@0.3.0

## 0.2.6

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

## 0.2.5

### Patch Changes

- ec6b3c6: Restore application label fallbacks, share canonical display-title precedence across plugin
  consumers, and align first-party descriptions with their published manifests. Preserve metadata
  diagnostics across catalog activation, avoid warnings about generated npm-name fallbacks, and
  report included-folder conflicts using their actual precedence.

  Accept npm dependency aliases in build catalogs while preserving canonical package provenance.
  Generate compatible imports for nested TypeScript source entries. Require Discovery 0.2.5 or
  later for Core testing and the optional package installer. Info reports static ID conflicts,
  runtime plugin IDs and unselected copies distinctly; missing versions remain explicitly unknown.
  Static ID conflicts have their own heading, separate from unavailable live state.

  Nested-copy resolution deliberately loads the code and CSS of the selected physical copy.
  Previously a bare root import could execute a different hoisted version from the one discovery
  had recorded. Inventory record keys identify a physical installation and can change with hoisting;
  package identity and runtime plugin IDs remain separate.

- afeb033: Record plugin provenance and full lowercase package/bundle identity without changing runtime IDs. Share canonical metadata projection with legacy fallbacks, expose passive inventory metadata, and group the Plugins page by declared or derived membership with URL-backed filters and distinct counts.

  Add authoritative static IDs to existing build sidecars, reject contradictory bindings and known activation collisions before new imports, and retain dependency-edge resolution for multiple installed copies. Trusted catalogs preserve multi-plugin loaders and accept optional complete static ID sets. Upgrade Core and Discovery together; new apps require their matching provenance APIs. Runtime package downloads and installation remain separate.

  Preserve the historical first-copy activation policy while retaining all physical copies in
  inspection. Unselected copies and their exclusive dependencies contribute no plugins, hooks,
  styles or slots; Doctor reports them separately. Resolve selected nested client entries with
  browser/import conditions instead of Node's require condition, including import-only exports.
  Accept historical nonempty runtime IDs in static sidecars, including numeric-leading build IDs.
  Retain the npm-name fallback in built metadata.name and existing included-folder metadata
  precedence. Attribute metadata warnings to their actual source files and keep ignored-file
  warnings in their contribution check regardless of filenames.

  Installed package manifest fields take precedence over conflicting in-code descriptive fields;
  legacy names and executable icons remain supported. Such loaded conflicts produce metadata
  warnings. Local and included folder declarations retain their previous precedence.

  Add opt-in runtime artifact installation and recovery without changing build-pinned catalogs.
  Core previews and replaces complete owned cohorts using its existing lifecycle planner. The
  optional Packages server entry reuses npm, esbuild, Rollup and SQLite; the browser entry shares
  actual host namespaces through SystemJS with JS/CSS integrity. Record durable activation intent,
  retain previous artifacts and recover interrupted updates or failed startup/host health checks.
  Data migrations, multi-browser rollout and authorization transports remain host-owned.

- Updated dependencies [ec6b3c6]
- Updated dependencies [afeb033]
  - @bitakit/core@0.2.8

## 0.2.4

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- 8f99932: Emit app themes from `src/themes/*.json` as constant literals, so an app with a theme file passes
  `typecheck` (`"schemaVersion": 1` stayed `number` and did not match Shell's option type).

## 0.2.3

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: Layout files are candidates of `layout.<family>`: the app's `src/layouts/<family>.tsx` and
  `src/layouts/<family>/<variant>.tsx`, and a plugin's `ui/layouts/...`. Families that no package,
  plugin or app declares become app-owned single slots. `choose` in `bitakit.config.ts` picks the
  occupant of single slots and reaches the runtime configuration. `describeBitaKit` lists
  `layouts` (`{ family, variant, file }`) per module and returns `choose`.
