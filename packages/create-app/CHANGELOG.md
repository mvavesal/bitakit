# @bitakit/create-app

## 0.2.4

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- 4e5ef15: Next.js apps with Shell get `src/app/(app)/error.tsx` and `src/app/not-found.tsx`, which render
  Shell's replaceable `screen.error` and `screen.not-found`.
- Updated dependencies [d5c8334]
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/cli@0.2.6
  - @bitakit/discovery@0.2.3

## 0.2.3

### Patch Changes

- 7617e2d: New apps and plugin packages depend on the release line (`^0.2.0`) for every `@bitakit/*` package
  instead of the generator's own version, so the generator can be released without the other
  packages.
