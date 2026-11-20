# @bitakit/core

## 0.3.4

### Patch Changes

- 960bed3: `findService(services, contract)` reads a contract that may have no provider: it returns `undefined` when no active plugin provides it (the plugin is absent or switched off) instead of throwing like `getService`. A provider that is declared but not created yet is still an error. Exported from `@bitakit/core` and `@bitakit/core/server`.

## 0.3.3

### Patch Changes

- e4e9440: Server Actions take `type: 'query' | 'mutation'` (default mutation), and `server.operations()` describes each operation's `type` and, where the schema implements Standard JSON Schema (zod 4), its `input` and `output` as JSON Schema (draft 2020-12) – the descriptions transport adapters and OpenAPI documents are built from.
- a8f1ce8: New optional package `@bitakit/orpc`: an oRPC transport over the server's exposed operations – `orpcHandler(server, { prefix, protocol })` for oRPC's RPC protocol or REST, `openapiDocument(server, { prefix })` for the OpenAPI 3.1 document – calling them through `server.call(…, { exposedOnly: true })`. Core exports `originRule`, the Origin check of `fetchHandler`, for such transports.
- 636efcb: Packages ship server halves: `bitakit build` writes `dist/server.js`, `dist/server.d.ts` and `dist/server.json` for a package's `server/` folder (and the browser entry now carries its `installers/`); a package declares it with `bitakit.server`, and an app's generated server file loads it. The app decides which package operations go over HTTP with `server.publish` in `bitakit.config.ts` (`ServerOptions.publish`); installing a package never adds endpoints by itself. The CSS audit skips the server entry.
- d113780: A discovered plugin can install a contribution kind from a file: `installers/<kind>.ts` (browser) or `server/installers/<kind>.ts` (server), default-exporting `defineInstaller<'<kind>'>(…)`. Discovery turns them into the plugin's `installs`; `bitakit add installer <plugin>/<kind> [--server]` writes one.
- ab106bc: The generated server takes its rate limits from `bitakit.config.ts` (`server.rateLimit: { limit?, windowMs? } | false`, checked at generation). Who the client is and a shared store are code: a server service that provides the new `rateLimit` contract (`@bitakit/core/server`) supplies `key` and `store`; options passed to `createServer` win over it. A server now drains a public call that is still waiting in an async rate-limit store before it stops. The app skill and the server docs now describe the built-in rate limit, CORS for trusted origins and the transport packages.
- faa7969: Server guards: CORS for `trustedOrigins` (preflight and response headers, never `*`; `crossOrigin` for other transports), rate limits for exposed `public` operations over HTTP (`createServer(config, { rateLimit })`, 120 a minute per client by default, 429 with `Retry-After`, replaceable store), and `server.system(name, { organizationId, permissions })`, the principal for jobs and webhooks that grants exactly the given permissions and never comes from a request. `OperationError` carries `retryAfter`.
- 70d0d5c: Server services may read `services` in their own factory without writing a return type. `ServerServices` is an interface over a lazily resolved namespace, and discovery writes the key of each one-service file itself (`DiscoveredServiceValue`), so the discovered map no longer waits for the file it describes.

## 0.3.2

### Patch Changes

- 40e8687: A plugin's server half. `@bitakit/core/server` runs the operations in a plugin's `server/actions/` folder: `defineAction` (the same helper, with server types) takes a required `access` (`'public'`, `'user'`, `'organization'` or `{ permission }`), `expose`, `input` and `output`, and `execute` receives the caller's verified, frozen `ctx`. `createServer` compiles every operation once into a stateless kernel; `fetchHandler(server)` serves `POST /api/rpc/<operation id>` with JSON, same-origin checks and a 1 MiB body limit; `requestContext` is the contract the app's authentication provider implements; `OperationError` carries safe error codes and messages to the browser. Client Actions and services receive a typed `remote` for the exposed operations, and an Action's default failure message shows an `OperationError`'s safe message. On the server, settings load per request with `load()` and event listeners receive `ctx`. `@bitakit/core/testing` adds `mountServer` and `identity` and a `remote` option for `mountPlugin`. A client Action with `access`, `expose` or `output` is now a startup error.

## 0.3.1

### Patch Changes

- 95f6c6e: An Action's `confirm` title and description translate like its title: the text as a catalog
  key, then `<id>.confirm.title` and `<id>.confirm.description`, then the literal.
- a29bb47: A `latest` Action run that rejects because a newer run aborted its signal now ends as skipped
  (`cancelled`) instead of failing, so typing into a search no longer shows "signal is aborted"
  messages or leaves unhandled rejections. The same applies to runs aborted when their
  registration is removed.

## 0.3.0

### Minor Changes

- df00bdd: Start the 0.3 release line: roles and permissions as configuration.

  Plugins declare the resources and operations they own in `permissions.ts` (`definePermissions`); the app declares its base roles once in `src/roles.ts` (`defineRoles`, with `standard`, `label`, `description`, `grants` and the `customRoles` option). Discovery collects both, types role grants against the discovered catalog (`PermissionMap`, `RoleMap`) and, like the runtime start, rejects a resource declared twice, grants of unknown resources or operations, a standard role extended twice and roles outside the app. Core only owns this vocabulary; the authorization provider translates it and decides every check. `@bitakit/organizations` gets the provider-independent role contract: backends report the organization's roles (base and custom, with permissions for presentation) and the viewer's permissions; invitations and role changes take role IDs; custom roles and the invitation domain policy are optional backend capabilities, and `normalizeInvitationDomain` is the one domain check that settings screens and providers share. The service offers assignable roles for choices only; the provider enforces every rule on the server.

### Patch Changes

- Updated dependencies [df00bdd]
  - @bitakit/discovery@0.3.0

## 0.2.9

### Patch Changes

- 3917b35: Add the optional UI-free scheduler with task contributions, runtime schedule sources, Croner
  execution and awaited cleanup. Extend integration installers with their owner's execution
  context and export the shared contribution expander. Add exact-first, unambiguous
  case-insensitive identifier resolution without renaming existing declarations or stored keys.
  Service observers expose per-call correlation and duration through async settlement.
- c84b956: Remove bundled package cover artwork and its package metadata and exports.

## 0.2.8

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

## 0.2.7

### Patch Changes

- 9e26994: Settings can hold lists. `control: 'list'` (inferred for a list default) edits short texts with add and remove; `control: 'checkboxes'` (inferred for a list default with `options`) chooses several of the options. Core validates each chosen value against the options and types it as a list of the option union.
- 9e26994: Service interceptor hooks receive `services`, as Action interceptors do, so an observer can record calls into its own service (for example a logger with `service: '*'`); skip the observer's own service to avoid recursion. A hook's `service` is now typed as `string`: with a glob or alias target it reports the actual service ID.

  Observed service methods keep their own properties. Before, observing the translation service dropped `translate.has`, so every fallback text was looked up as a key and reported as missing.

## 0.2.6

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.

## 0.2.5

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: A `policy: 'single'` slot is now a replaceable part: several plugins may attach a candidate (the
  same contributor and key twice is still a conflict) and outlets render one. `selectSingle`
  decides: the app's `choose` entry (`BitaKitRuntimeConfig.choose`, from `bitakit.config.ts`), then
  the app's own contribution, then the only candidate; a tie selects none. `candidateNames` gives
  the names a choice accepts. Layout families are single slots `layout.<family>`: `pluginLayout`
  now takes `(module, family, variant, source)` and returns the slot candidate, `layoutSlots`
  declares families, and pages may name any declared family (the error names the files to add).

## 0.2.4

### Patch Changes

- 6c3b51f: Add side-effect-free plugin change previews and host-owned Action bindings through the existing
  runtime planner and ActionList. Enable session plugin controls with dependency confirmation,
  revision guards, protected owners and recovery feedback.

  Use shared standard Card and Item groups with wrapping plugin metadata, standard switches,
  separators and scrollbar clearance. Show all filtered plugins without pagination or full-row
  hover while preserving URL-backed search, tag filters and detail navigation.

## 0.2.3

### Patch Changes

- b2a0893: Adds `assertAuthContract` to `@bitakit/core/testing`: an `auth` provider's tests check the AuthService contract rules and fail with the broken rule.
