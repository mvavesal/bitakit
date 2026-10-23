# @bitakit/app-preferences

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
