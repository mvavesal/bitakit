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
