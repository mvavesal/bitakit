# @bitakit/organizations

## 0.2.5

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- Updated dependencies [4ccdd11]
  - @bitakit/core@0.2.6

## 0.2.4

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
  - @bitakit/core@0.2.5

## 0.2.3

### Patch Changes

- ed9f5b9: Use shared standard Card and Item groups for Quick Search settings, with aligned Outline icons,
  separators and a complete Clear history row. Complete Quick Search plugin metadata and translations,
  and categorize the organization service with its security tag.

  Add an independent, off-by-default setting for displaying recently opened Quick Search results,
  without changing history collection or persistence.
