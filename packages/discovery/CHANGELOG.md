# @bitakit/discovery

## 0.2.4

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- 8f99932: Emit app themes from `src/themes/*.json` as constant literals, so an app with a theme file passes
  `typecheck` (`"schemaVersion": 1` stayed `number` and did not match Shell's option type).

## 0.2.3

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: Layout files are candidates of `layout.<family>`: the app's `src/layouts/<family>.tsx` and
  `src/layouts/<family>/<variant>.tsx`, and a plugin's `ui/layouts/...`. Families that no package,
  plugin or app declares become app-owned single slots. `choose` in `bitakit.config.ts` picks the
  occupant of single slots and reaches the runtime configuration. `describeBitaKit` lists
  `layouts` (`{ family, variant, file }`) per module and returns `choose`.
