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

## Rules

- The backend (the server) owns authorization; an active organization ID in the client is not
  proof of membership, and a disabled membership grants nothing.
- Do not build a second organization store or membership check in the app.
- Translations: compose `./locales/<lang>.json` with `mergePluginMessages`.
