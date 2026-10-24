# @bitakit/core

## 0.2.5

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: A `policy: 'single'` slot is now a replaceable part: several plugins may attach a candidate (the
  same contributor and key twice is still a conflict) and outlets render one. `selectSingle`
  decides: the app's `choose` entry (`BitaKitRuntimeConfig.choose`, from `bitakit.config.ts`), then
  the app's own contribution, then the only candidate; a tie selects none. `candidateNames` gives
  the names a choice accepts. Layout families are single slots `layout.<family>`: `pluginLayout`
  now takes `(module, family, variant, source)` and returns the slot candidate, `layoutSlots`
  declares families, and pages may name any declared family (the error names the files to add).

## 0.2.4

### Patch Changes

- 6c3b51f: Add side-effect-free plugin change previews and host-owned Action bindings through the existing
  runtime planner and ActionList. Enable session plugin controls with dependency confirmation,
  revision guards, protected owners and recovery feedback.

  Use shared standard Card and Item groups with wrapping plugin metadata, standard switches,
  separators and scrollbar clearance. Show all filtered plugins without pagination or full-row
  hover while preserving URL-backed search, tag filters and detail navigation.

## 0.2.3

### Patch Changes

- b2a0893: Adds `assertAuthContract` to `@bitakit/core/testing`: an `auth` provider's tests check the AuthService contract rules and fail with the broken rule.
