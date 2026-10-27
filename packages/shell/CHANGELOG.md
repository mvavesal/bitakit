# @bitakit/shell

## 0.2.8

### Patch Changes

- 9e26994: Add `--selected` and `--selected-border` theme tokens for one selected state (the muted surface with a primary-tinted edge by default); `FieldLabel` choice cards use them, and select triggers get the same round corners as text inputs. Shell's theme defaults and bundled themes define both tokens.
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
- Updated dependencies [9e26994]
  - @bitakit/core@0.2.7
  - @bitakit/ui@0.2.8

## 0.2.7

### Patch Changes

- 2308d05: Themes live at `/settings/theme` and Layout at `/settings/layout` (were `/settings/shell` and `/settings/shell/layout`). The theme select spans the row with the theme tools (customize, import, download, reset to default) below it as one icon toolbar with tooltips; long theme names are shortened while their source stays visible, and the menu matches the select's width.

## 0.2.6

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- 8f99932: Declare HeroUI's peer dependencies (`react-aria`, `react-aria-components`, `@react-aria/utils`,
  `@react-aria/ssr`, `@internationalized/date`) as Shell dependencies, so apps installed with
  Yarn, which does not install peers, build. npm and pnpm resolve the same versions as before.
- Updated dependencies [4ccdd11]
  - @bitakit/core@0.2.6
  - @bitakit/ui@0.2.7

## 0.2.5

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: Layouts and screens are replaceable parts. Shell declares `layout.app` (the whole frame),
  `layout.auth` (new default: a centered column with the brand), `layout.error`, `layout.full-page`
  and the screens `screen.not-found`, `screen.error` (payload `{ reset }`), `screen.forbidden` and
  `screen.loading`. A file in the app or a plugin replaces a default: `src/layouts/auth.tsx`,
  `ui/slots/screen.not-found.tsx`. `AppShell` gains a `layout` prop for framework files, and
  `ShellAuthLayout`/`ShellErrorLayout` (`AppShell.AuthLayout`/`.ErrorLayout`) are exported.
- ddd1daa: Themes can be shared as JSON files. The Themes page has **Download theme** and **Import theme**
  buttons: a download saves the theme shown in the preview as `<name>.theme.json`, and an import
  opens the file as an unsaved personal copy with a new ID that **Save copy and apply** saves.
  Imported files may set only known theme tokens, and values that load resources (`url()`, image
  functions) or contain CSS escapes, `;`, braces, `<`, `>` or `@` are rejected. New exports:
  `parseThemeFile`, `stringifyThemeFile`, `themeFileSchema`, `themeFileSchemaUrl`, and the JSON
  Schema at `@bitakit/shell/theme.schema.json` that downloaded files reference in `$schema`.
  Source themes (`src/themes/*.json`, the `themes` option) accept and ignore `$schema`, so a
  downloaded file can be copied into the app unchanged.
- Updated dependencies [03439c7]
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/ui@0.2.6
  - @bitakit/core@0.2.5

## 0.2.4

### Patch Changes

- 39b4895: Distinguish the app's inherited default appearance from the explicit BitaKit palette. Preview app CSS colors accurately and preserve Reset's return to the app default.

## 0.2.3

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
