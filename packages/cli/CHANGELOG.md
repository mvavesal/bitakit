# @bitakit/cli

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

- Updated dependencies [ec6b3c6]
- Updated dependencies [afeb033]
  - @bitakit/core@0.2.8
  - @bitakit/discovery@0.2.5

## 0.2.7

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- 4ccdd11: Create plugin-local AGENTS.md and CLAUDE.md files with `bitakit add plugin` in default,
  example and minimal modes. The guide describes the plugin's actual starter files and contracts;
  the bundled app development skill explains how to keep each plugin's guidance with its code.

  Refine the skill's task scope, package-version guidance and verification workflow. Keep complete
  examples in references, add app/package bootstrap and plugin-guide examples, and reuse existing
  authorization and CLI tooling instead of prescribing redundant checks or confirmation steps.

- Updated dependencies [4ccdd11]
- Updated dependencies [8f99932]
  - @bitakit/core@0.2.6
  - @bitakit/discovery@0.2.4

## 0.2.6

### Patch Changes

- d5c8334: The app development skill gains best practices and verified samples: a "Choose the mechanism"
  table, a step-by-step Bookmarks feature (`references/worked-example.md`), loading and saving data
  through an API route with loading and error states and a headless test (`references/data-and-api.md`),
  and common mistakes with their fixes and naming conventions (`references/best-practices.md`). It
  also points agents to the Shell README's Theme files section for colors, fonts and themes.
- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: `bitakit add layout <family>[/<variant>]` writes a candidate of `layout.<family>`, with
  `--plugin <id>` into an app plugin's `ui/layouts/`. `bitakit slots` shows which candidate renders
  each replaceable part (`--json`: `selection`), and doctor checks that replaceable parts are
  decided and that `choose` names single slots. The app skill gains the recipe
  `layouts-and-screens.md`, and agents are told to read each package's `AGENTS.md`.
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/core@0.2.5
  - @bitakit/discovery@0.2.3

## 0.2.5

### Patch Changes

- 15021a2: Add plugin-owned Quick Search sources with concurrent, cancellable results, shared source
  preferences, temporary category filters and identity-scoped recent history. Preserve live
  navigation guards and existing result defaults. Ship a typed extension example and source
  authoring guidance.

  Document minimal, component-owned CSS extension points in the existing agent guidance.
  Keep plugin-specific source guidance with Quick Search; the shipped app-development skill
  directs authors to installed package contracts and local documentation without a search recipe.

  Keep the dialog compact with one temporary category dropdown below its input. Persistent
  source switches stay in Settings with optional source icons and a default Search icon.
  Give the AppBar trigger the central input surface and a Search icon while retaining its
  native button behavior and standard height. Use muted placeholder text and the existing
  keyboard-hint keycap for its platform-aware shortcut.
