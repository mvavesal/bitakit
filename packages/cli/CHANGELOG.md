# @bitakit/cli

## 0.2.6

### Patch Changes

- d5c8334: The app development skill gains best practices and verified samples: a "Choose the mechanism"
  table, a step-by-step Bookmarks feature (`references/worked-example.md`), loading and saving data
  through an API route with loading and error states and a headless test (`references/data-and-api.md`),
  and common mistakes with their fixes and naming conventions (`references/best-practices.md`). It
  also points agents to the Shell README's Theme files section for colors, fonts and themes.
- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: `bitakit add layout <family>[/<variant>]` writes a candidate of `layout.<family>`, with
  `--plugin <id>` into an app plugin's `ui/layouts/`. `bitakit slots` shows which candidate renders
  each replaceable part (`--json`: `selection`), and doctor checks that replaceable parts are
  decided and that `choose` names single slots. The app skill gains the recipe
  `layouts-and-screens.md`, and agents are told to read each package's `AGENTS.md`.
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/core@0.2.5
  - @bitakit/discovery@0.2.3

## 0.2.5

### Patch Changes

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
