# @bitakit/scheduler

## 0.3.0

### Minor Changes

- df00bdd: Start the 0.3 release line: roles and permissions as configuration.

  Plugins declare the resources and operations they own in `permissions.ts` (`definePermissions`); the app declares its base roles once in `src/roles.ts` (`defineRoles`, with `standard`, `label`, `description`, `grants` and the `customRoles` option). Discovery collects both, types role grants against the discovered catalog (`PermissionMap`, `RoleMap`) and, like the runtime start, rejects a resource declared twice, grants of unknown resources or operations, a standard role extended twice and roles outside the app. Core only owns this vocabulary; the authorization provider translates it and decides every check. `@bitakit/organizations` gets the provider-independent role contract: backends report the organization's roles (base and custom, with permissions for presentation) and the viewer's permissions; invitations and role changes take role IDs; custom roles and the invitation domain policy are optional backend capabilities, and `normalizeInvitationDomain` is the one domain check that settings screens and providers share. The service offers assignable roles for choices only; the provider enforces every rule on the server.

### Patch Changes

- Updated dependencies [df00bdd]
  - @bitakit/core@0.3.0

## 0.2.1

### Patch Changes

- 3917b35: Add the optional UI-free scheduler with task contributions, runtime schedule sources, Croner
  execution and awaited cleanup. Extend integration installers with their owner's execution
  context and export the shared contribution expander. Add exact-first, unambiguous
  case-insensitive identifier resolution without renaming existing declarations or stored keys.
  Service observers expose per-call correlation and duration through async settlement.
- c84b956: Remove bundled package cover artwork and its package metadata and exports.
- Updated dependencies [3917b35]
- Updated dependencies [c84b956]
  - @bitakit/core@0.2.9
