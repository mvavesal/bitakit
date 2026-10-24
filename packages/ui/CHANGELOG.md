# @bitakit/ui

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
