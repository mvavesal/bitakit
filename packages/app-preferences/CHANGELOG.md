# @bitakit/app-preferences

## 0.2.10

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
  - @bitakit/ui@0.2.9

## 0.2.9

### Patch Changes

- 9e26994: Settings can hold lists. `control: 'list'` (inferred for a list default) edits short texts with add and remove; `control: 'checkboxes'` (inferred for a list default with `options`) chooses several of the options. Core validates each chosen value against the options and types it as a list of the option union.
- 4c1db5a: Declare the existing Settings destination in the public ActionMap so strict generated apps can bind it directly in host-owned navigation placements.
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
  - @bitakit/core@0.2.7
  - @bitakit/ui@0.2.8

## 0.2.8

### Patch Changes

- 2308d05: A search shortcut inside Settings: the `app-preferences.search` Action (default key `/`, option `searchShortcut`, `false` turns it off) focuses the settings search while Settings is open, and the search input shows the key while empty.

## 0.2.7

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- Updated dependencies [4ccdd11]
  - @bitakit/core@0.2.6
  - @bitakit/ui@0.2.7

## 0.2.6

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- Updated dependencies [03439c7]
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/ui@0.2.6
  - @bitakit/core@0.2.5

## 0.2.5

### Patch Changes

- 10cd9f1: Every setting has a stable anchor, `setting-<key>` (`settingAnchor(key)`), and `settingHref(basePath, section, key)` builds a link to it, such as `/settings/shell#setting-shell.theme`. Opening such a link, or changing the hash to one, scrolls the field to the middle of the page, focuses its control and highlights it briefly. `sectionHref` is exported too.

## 0.2.4

### Patch Changes

- 982ac8c: Bundle Warm Sand, Soft Rose, Calm Sage, High Contrast and Slate Flat as optional themes in
  Appearance. Each includes light and dark palettes and reuses the central color, corner and
  depth tokens. Keep BitaKit Default selected initially and retain the existing personal-copy flow.

  Split Appearance into Themes and Layout settings pages, preserving the existing Themes URL
  and the shared settings values.

  Add Ocean Blue, Golden Amber and Forest Green with the default raised finish. Show selected
  themes and draft changes in a responsive live preview, add visual choice samples, and keep
  the color picker open when interacting with its portaled sliders.

  Use the shared RadioGroup primitives and standard settings choice cards for corner radius,
  surface shadow and button finish, matching the existing color scheme controls.

  Include interactive checkbox and radio samples in the live preview, backed by the standard
  shared primitives. Reset inherited effect tokens so raised previews also work while a flat
  theme is active.

  Slightly soften the standard checkbox corners through the shared radius token.

- Updated dependencies [982ac8c]
  - @bitakit/ui@0.2.5

## 0.2.3

### Patch Changes

- 34fb6d0: Add an All plugins / Enabled / Disabled status filter beside Tags. Combine it with existing
  search and tag filters, preserve it in detail/back URLs, and derive results directly from
  runtime inventory so plugin toggles update the filtered list immediately.

  Use the standard Empty component with a search icon and localized guidance when no plugins
  match the selected search and filters.

- faf4622: Label the existing plugins settings category Integrations (Integrationen in German), preserving
  the Plugins page title, category identifier and routes.
- 6c3b51f: Add side-effect-free plugin change previews and host-owned Action bindings through the existing
  runtime planner and ActionList. Enable session plugin controls with dependency confirmation,
  revision guards, protected owners and recovery feedback.

  Use shared standard Card and Item groups with wrapping plugin metadata, standard switches,
  separators and scrollbar clearance. Show all filtered plugins without pagination or full-row
  hover while preserving URL-backed search, tag filters and detail navigation.

- e969dfd: Give the Settings breadcrumb bar a subtle surface using the shared card theme color, retaining
  its existing dimensions and adapting to light, dark and custom theme presets.
