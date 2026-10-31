---
'@bitakit/core': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
'@bitakit/packages': patch
'@bitakit/ui': patch
'@bitakit/app-preferences': patch
'@bitakit/quick-search': patch
'@bitakit/devtools': patch
'@bitakit/shell': patch
'@bitakit/next-intl': patch
---

Restore application label fallbacks, share canonical display-title precedence across plugin
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
