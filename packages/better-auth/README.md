# @bitakit/better-auth

Optional BitaKit plugin for an existing, configured Better Auth client. It provides the general
`auth` service (session snapshot, changes, sign-out) on the client's session atom. It has no
sign-in UI and is no replacement for server-side permission checks; organizations and e-mail
hooks are separate optional entry points of the same package.

## Install and provide the client

The package manifest declares `bitakit: { plugin: './plugin', configuration: 'better-auth' }`,
so a generated app composes the plugin without host code. The plugin takes no host objects:
the client arrives through the `betterAuthClient` contract (`better-auth-client`). Provide it
once in the app:

```ts
// src/services/better-auth-client.ts
import { defineService } from '@bitakit/core';
import { betterAuthClient } from '@bitakit/better-auth';
import { authClient } from '../lib/auth-client';

export default defineService(() => ({ client: authClient }), { provides: betterAuthClient });
```

The client is wrapped in `{ client }`: a Better Auth client answers every property, `subscribe`
included, so the runtime would observe a bare client as a service and call it. Without that
service, startup fails with a named error. The contract is not called
`auth.client`: `auth` is the authentication service itself and cannot also be a namespace.

Options live in `src/configs/better-auth.ts`:

```ts
export default defineConfig({
  defaults: { paths: { signIn: '/login', afterSignIn: '/', afterSignOut: '/' } },
});
```

`betterAuthPlugin(options?)` accepts `{ paths?, signIn?, signOut? }`. `paths` are validated
when the configuration is created. An optional `signIn(options)` delegates a native login
flow; without it, `useAuth().signIn()` opens `paths.signIn`. `signOut` replaces the client's
sign-out; use the shared UI hook for post-logout navigation instead of redirecting inside it.
Manual composition passes the same options and provides the client through
`createRuntime(config, { services: { [betterAuthClient]: { client: authClient } } })`, the
`FoundationProvider` `services` prop or any plugin service with `provides: betterAuthClient`.

See the [client authentication guide](../../apps/docs/content/docs/reference/authentication.mdx) for `AuthBoundary`, safe return
destinations and a provider adapter template.

## Organizations

`@bitakit/better-auth/organizations` exports `betterAuthOrganizations(client, extensions?)`, the
general organization backend on the SDK methods of a client configured with Better Auth's
organization plugin (including paginated member lists, native creation and activation, profile,
logo, website metadata and deletion). Explicit server extensions may take over operations;
member suspension needs one. `sessionOrganizationBackend(client, authenticated, signedOut)`
separates an explicit local demo entry from real accounts; failures of the real backend are
never answered with demo data. Provide the result as the `organizationBackend` contract of
`@bitakit/organizations`:

```ts
// src/services/organization-backend.ts
export default defineService(
  () => sessionOrganizationBackend(authClient, betterAuthOrganizations(authClient)),
  { provides: organizationBackend },
);
```

The UI permission projection supports the standard roles owner/admin/member; a disabled member
is rejected when loading. Backend policies and suspension hooks remain mandatory; the client
adapter is not a security boundary. The UI comes from `@bitakit/better-auth-ui/organizations`.

## E-mail (server)

`@bitakit/better-auth/email` exports `betterAuthEmail(emailService, { invitationURL })`, the
Better Auth callbacks `sendVerificationEmail`, `sendResetPassword` and `sendInvitationEmail`.
The first two belong in the auth options, the third in the organization plugin configuration.
The host decides its real invitation route. They depend only on the general e-mail contract,
not on Nodemailer, and are never injected into an existing server auth instance.

## Standard browser client

`createBetterAuthClient` from `@bitakit/better-auth/client` creates the shared browser client
with organization/teams, multi-session, API key and two-factor extensions. These are client
capabilities, not server activation: the server must configure the matching extensions.
Native client options such as `baseURL` are supported; `plugins` append further extensions.

## Source responsibilities

- `src/index.ts`: the `auth` service on the client session, `betterAuthClient`, `betterAuthPlugin`.
- `src/plugin.ts` (`./plugin`): the package plugin entry the manifest names.
- `src/organizations.ts`, `src/organization-session.ts` (`./organizations`): organization backend.
- `src/email.ts` (`./email`), `src/client.ts` (`./client`).

### Native session display compatibility

`createBetterAuthClient` retains Better Auth's native client and extensions. Its public fetch
success hook supplies `Unknown` for missing/blank user-agent display values in list-sessions
responses, because native HeroUI session cards cannot parse an empty user agent. It keeps
every session/token, delegates the caller's hook and leaves storage, authorization and all
other endpoint payloads unchanged. Hosts providing a different native client do not receive
this preset behavior automatically.
