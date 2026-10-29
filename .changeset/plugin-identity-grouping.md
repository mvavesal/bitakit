---
'@bitakit/core': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
'@bitakit/packages': patch
'@bitakit/app-preferences': patch
'@bitakit/create-app': patch
'@bitakit/shell': patch
'@bitakit/quick-search': patch
---

Record plugin provenance and full lowercase package/bundle identity without changing runtime IDs. Share canonical metadata projection with legacy fallbacks, expose passive inventory metadata, and group the Plugins page by declared or derived membership with URL-backed filters and distinct counts.

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
