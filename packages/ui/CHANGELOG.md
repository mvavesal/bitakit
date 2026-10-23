# @bitakit/ui

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
