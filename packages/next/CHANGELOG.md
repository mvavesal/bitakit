# @bitakit/next

## 0.3.0

### Minor Changes

- df00bdd: Start the 0.3 release line: roles and permissions as configuration.

  Plugins declare the resources and operations they own in `permissions.ts` (`definePermissions`); the app declares its base roles once in `src/roles.ts` (`defineRoles`, with `standard`, `label`, `description`, `grants` and the `customRoles` option). Discovery collects both, types role grants against the discovered catalog (`PermissionMap`, `RoleMap`) and, like the runtime start, rejects a resource declared twice, grants of unknown resources or operations, a standard role extended twice and roles outside the app. Core only owns this vocabulary; the authorization provider translates it and decides every check. `@bitakit/organizations` gets the provider-independent role contract: backends report the organization's roles (base and custom, with permissions for presentation) and the viewer's permissions; invitations and role changes take role IDs; custom roles and the invitation domain policy are optional backend capabilities, and `normalizeInvitationDomain` is the one domain check that settings screens and providers share. The service offers assignable roles for choices only; the provider enforces every rule on the server.

### Patch Changes

- Updated dependencies [df00bdd]
  - @bitakit/core@0.3.0
  - @bitakit/discovery@0.3.0
  - @bitakit/ui@0.3.0

## 0.2.5

### Patch Changes

- c84b956: Remove bundled package cover artwork and its package metadata and exports.
- Updated dependencies [3917b35]
- Updated dependencies [c84b956]
  - @bitakit/core@0.2.9
  - @bitakit/discovery@0.2.6
  - @bitakit/ui@0.2.10

## 0.2.4

### Patch Changes

- 4ccdd11: Ship a `CLAUDE.md` beside the package's `AGENTS.md`. It only imports `AGENTS.md`, so Claude Code
  reads the same complete guide as other coding agents.
- Updated dependencies [4ccdd11]
- Updated dependencies [8f99932]
  - @bitakit/core@0.2.6
  - @bitakit/discovery@0.2.4
  - @bitakit/ui@0.2.7

## 0.2.3

### Patch Changes

- b3a686f: Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
  with what it provides, how to extend or replace it, its rules and a minimal example. The app
  development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
- Updated dependencies [03439c7]
- Updated dependencies [b3a686f]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
- Updated dependencies [4e5ef15]
  - @bitakit/ui@0.2.6
  - @bitakit/core@0.2.5
  - @bitakit/discovery@0.2.3
