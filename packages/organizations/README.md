# @bitakit/organizations

Provider-independent organization contracts, service, and local demo backend. This package has no UI implementation and no Better Auth dependency.

`organizationsPlugin()` takes no arguments. Its service reads the data source from the
`organizationBackend` contract (`organization-backend`), which the host provides once, created
for each mount:

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

Tests and local demos provide `createDemoOrganizationBackend()` from `/demo` the same way, or
pass it as `services: { [organizationBackend]: createDemoOrganizationBackend() }`. Without a
backend, startup fails with a named error. The contract is not called `organizations.backend`:
`organizations` is the service itself and cannot also be a namespace. The package has no
`bitakit` manifest, so it is never installed implicitly; compose `organizationsPlugin()`
explicitly, for example through `additionalPlugins` of the generated `BitaKitProvider`.

Consumers access the shared `organizationService` key. The service handles subscriptions, stale-response protection, context invalidation, and disposal; the backend owns final authorization. Existing membership suspension and tenant isolation checks remain intact.

The `/demo` entry provides an in-memory backend without real authentication or email delivery. UI integration now belongs to `@bitakit/better-auth-ui/organizations`; migrate imports from the removed `@bitakit/organizations/react` entry. The native Better Auth UI organization exports remain available through its `/plugins/organization` entry.

Implementation lives in `src/services/organizations.ts`; contracts, plugin composition, and shared website validation have separate modules. Run `npm test --workspace @bitakit/organizations` for service regressions. UI lifecycle regressions live in better-auth-ui.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.
