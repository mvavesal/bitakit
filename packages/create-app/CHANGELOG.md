# @bitakit/create-app

## 0.2.6

### Patch Changes

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
  - @bitakit/discovery@0.2.5
  - @bitakit/cli@0.2.8

## 0.2.5

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- 8f99932: Install the new app with the package manager that started the generator (`npm create`,
  `pnpm create`, `yarn create`, `bunx`), or the one named with `--package-manager`; the summary,
  next steps and the generated README use its commands. Plugin packages stay npm workspaces.
  `yarn create @bitakit/app` works with Yarn 1 through a `create-app` bin. Generated apps require
  `@bitakit/shell` 0.2.6 or newer: their error and not-found files need its 0.2.5 APIs and Yarn
  needs its declared peers, so a resolver that skips fresh releases cannot install an older Shell.
- Updated dependencies [4ccdd11]
- Updated dependencies [8f99932]
- Updated dependencies [4ccdd11]
  - @bitakit/cli@0.2.7
  - @bitakit/discovery@0.2.4

## 0.2.4

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: Next.js apps with Shell get `src/app/(app)/error.tsx` and `src/app/not-found.tsx`, which render
  Shell's replaceable `screen.error` and `screen.not-found`.
- Updated dependencies [d5c8334]
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/cli@0.2.6
  - @bitakit/discovery@0.2.3

## 0.2.3

### Patch Changes

- 7617e2d: New apps and plugin packages depend on the release line (`^0.2.0`) for every `@bitakit/*` package
  instead of the generator's own version, so the generator can be released without the other
  packages.
