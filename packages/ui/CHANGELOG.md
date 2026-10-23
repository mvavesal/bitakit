# @bitakit/ui

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
