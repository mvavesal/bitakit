# @bitakit/discovery

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
