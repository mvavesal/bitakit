# @bitakit/ui

## 0.2.9

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

- Updated dependencies [ec6b3c6]
- Updated dependencies [afeb033]
  - @bitakit/core@0.2.8

## 0.2.8

### Patch Changes

- 9e26994: `PageHeader` wraps its trailing controls instead of squeezing the title: with many toolbar Actions the title keeps at least 12rem and the buttons flow onto the next line.
- 9e26994: Add `--selected` and `--selected-border` theme tokens for one selected state (the muted surface with a primary-tinted edge by default); `FieldLabel` choice cards use them, and select triggers get the same round corners as text inputs. Shell's theme defaults and bundled themes define both tokens.
- 9e26994: A `SidebarGroup` in the sidebar's header or footer no longer adds its own padding to theirs, so a section contributed to `sidebar.header` or `sidebar.footer` lines up with the groups in the sidebar's content.
- 9e26994: `StandardActionMenu` closes after a navigation item routes: the link cancels its click for client-side routing, so Radix never saw a selection and the menu stayed open over the new page.
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
  - @bitakit/core@0.2.7

## 0.2.7

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- Updated dependencies [4ccdd11]
  - @bitakit/core@0.2.6

## 0.2.6

### Patch Changes

- 03439c7: The plugin management Action (`runtime.plugins.change`) binds whenever the runtime is ready and
  idle. Before, an app whose plugins have no `onStart` hooks logged
  `[bitakit] Host Actions could not start` in React Strict Mode (every development page load) and
  left the Action unbound, because the runtime was stopped for Strict Mode's second mount when the
  binding ran and nothing retried it.
- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: `PluginSlot` takes `fallback`, rendered while no contribution is placed and instead of a failing
  occupant of a single slot, and passes `children` to its contributions so layouts can wrap pages.
  For single slots, `useSlot` keeps the candidate `selectSingle` picks, reports `ambiguous` or
  `choice-unavailable` with `diagnostics.candidates`, logs a tie once, and renders the selected file
  contribution before the runtime has started (after payload validation) so the default does not
  flash. Entries carry their contribution key as `entryKey`; `SlotProps` includes `children`.
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
  - @bitakit/core@0.2.5

## 0.2.5

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

## 0.2.4

### Patch Changes

- 6c3b51f: Add side-effect-free plugin change previews and host-owned Action bindings through the existing
  runtime planner and ActionList. Enable session plugin controls with dependency confirmation,
  revision guards, protected owners and recovery feedback.

  Use shared standard Card and Item groups with wrapping plugin metadata, standard switches,
  separators and scrollbar clearance. Show all filtered plugins without pagination or full-row
  hover while preserving URL-backed search, tag filters and detail navigation.

- dfeee14: Use the central card surface for the App Bar and a uniform foreground outline for inset content, preserving theme and preset colors.
- e8a3314: Make the App Bar bottom divider more visible using the theme foreground color.

## 0.2.3

### Patch Changes

- 796c36f: Slot outlets follow only the Actions their own entries reference. A component or data slot no
  longer rebuilds its view, and re-renders every contribution, whenever any Action runs or a service
  change refreshes Action presentation; an Actions slot renders again only when one of its own
  Actions changes. `PluginSlot` memoizes each contribution on its component and payload.
