---
'@bitakit/organizations': patch
---

Configurable organization roles: `organizationsPlugin({ roles })` takes the app's roles (most powerful first, the same IDs as Better Auth's `organization({ roles })`). The service exposes `roles`, `assignableRoles()`, `roleKind()` and `defaultRole`; invitations and role changes accept any assignable role. Without the option the roles stay `owner`, `admin`, `member`.
