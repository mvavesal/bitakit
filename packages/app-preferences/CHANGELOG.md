# @bitakit/app-preferences

## 0.3.0

### Minor Changes

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
