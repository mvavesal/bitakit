---
'@bitakit/app-preferences': minor
'@bitakit/cli': minor
'@bitakit/core': minor
'@bitakit/create-app': minor
'@bitakit/devtools': minor
'@bitakit/discovery': minor
'@bitakit/email': minor
'@bitakit/next-intl': minor
'@bitakit/next': minor
'@bitakit/nodemailer': minor
'@bitakit/organizations': minor
'@bitakit/packages': minor
'@bitakit/quick-search': minor
'@bitakit/scheduler': minor
'@bitakit/shell': minor
'@bitakit/tanstack': minor
'@bitakit/ui': minor
---

Start the 0.3 release line: roles and permissions as configuration.

Plugins declare the resources and operations they own in `permissions.ts` (`definePermissions`); the app declares its base roles once in `src/roles.ts` (`defineRoles`, with `standard`, `label`, `description`, `grants` and the `customRoles` option). Discovery collects both, types role grants against the discovered catalog (`PermissionMap`, `RoleMap`) and, like the runtime start, rejects a resource declared twice, grants of unknown resources or operations, a standard role extended twice and roles outside the app. Core only owns this vocabulary; the authorization provider translates it and decides every check.
