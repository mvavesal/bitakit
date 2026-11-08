# @bitakit/organizations — guide for agents

> For agents building an app with this package (it ships in
> `node_modules/@bitakit/organizations`). To change the package itself, follow the
> repository's own AGENTS.md instead.

Provider-independent organization contracts and the `organizations` service: the list, the
active organization, members and invitations, with stale-response protection. It has no UI and
no auth provider; the organization UI comes from `@bitakit/better-auth-ui/organizations`.

## Use it

It has no `bitakit` manifest, so discovery never installs it. Compose `organizationsPlugin()`
explicitly (for example through `additionalPlugins` of the generated `BitaKitProvider`) and
provide its backend once, as an app service:

```ts
// src/services/organization-backend.ts
import { defineService } from '@bitakit/core';
import { organizationBackend } from '@bitakit/organizations';
import { betterAuthOrganizations } from '@bitakit/better-auth/organizations';
import { authClient } from '../lib/auth-client';

export default defineService(() => betterAuthOrganizations(authClient), {
  provides: organizationBackend,
});
```

- Read it through the shared key: `getService(services, organizationService)` or
  `useService(organizationService)`.
- Tests and demos use `createDemoOrganizationBackend()` from `@bitakit/organizations/demo`
  (in memory, no real authentication or email).
- Without a backend, startup fails with a named error.

## Roles, custom roles and the invitation policy

- The backend reports the organization's roles in `load()`: `roles` (the app's base roles from
  `defineRoles`, then the organization's custom roles: `id`, `label`, `description`, `standard`,
  `custom`, `permissions`) and `viewerPermissions`. Without them the provider's standard
  `owner`, `admin`, `member` apply.
- The service offers `roles`, `assignableRoles()` and `defaultRole` (the role extending
  `member`). Assignable roles never include the creator role (`standard: 'owner'`) and, with
  permission data, only roles the viewer's permissions cover. This is presentation only: the
  provider enforces the same rule on the server (for Better Auth: the membership guard of
  `createOrganizationPlugin`). `invite(email, role?)` and `updateRole(memberId, role)` take role IDs.
- Optional capabilities: `customRoles` (`createCustomRole`, `updateCustomRole`,
  `deleteCustomRole`; only custom roles change) and `invitationPolicy` (`invitationPolicy()`,
  `saveInvitationPolicy(policy)`; the provider validates, normalizes and checks the right).
  Check `service.capabilities` before offering them. Each app builds its own screens.

## Rules

- The backend (the server) owns authorization; an active organization ID in the client is not
  proof of membership, and a disabled membership grants nothing.
- Do not build a second organization store or membership check in the app.
- Translations: compose `./locales/<lang>.json` with `mergePluginMessages`.
