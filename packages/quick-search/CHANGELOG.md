# @bitakit/quick-search

## 0.2.3

### Patch Changes

- ed9f5b9: Add a Show result source setting, disabled by default, to control the existing muted source
  labels in Quick Search. Reuse App Preferences and the runtime settings store while preserving
  existing ownership, search matching and shortcuts.
- ed9f5b9: Use shared standard Card and Item groups for Quick Search settings, with aligned Outline icons,
  separators and a complete Clear history row. Complete Quick Search plugin metadata and translations,
  and categorize the organization service with its security tag.

  Add an independent, off-by-default setting for displaying recently opened Quick Search results,
  without changing history collection or persistence.

- 15021a2: Add plugin-owned Quick Search sources with concurrent, cancellable results, shared source
  preferences, temporary category filters and identity-scoped recent history. Preserve live
  navigation guards and existing result defaults. Ship a typed extension example and source
  authoring guidance.

  Document minimal, component-owned CSS extension points in the existing agent guidance.
  Keep plugin-specific source guidance with Quick Search; the shipped app-development skill
  directs authors to installed package contracts and local documentation without a search recipe.

  Keep the dialog compact with one temporary category dropdown below its input. Persistent
  source switches stay in Settings with optional source icons and a default Search icon.
  Give the AppBar trigger the central input surface and a Search icon while retaining its
  native button behavior and standard height. Use muted placeholder text and the existing
  keyboard-hint keycap for its platform-aware shortcut.
