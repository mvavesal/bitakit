# Content Demo

A smaller Next.js host for Bita's Shell, settings and Better Auth integrations.
Application-owned routes, authentication options, locale configuration and provider
composition remain in this workspace. Shared runtime behavior comes from the packages.

From the repository root:

```sh
npm run dev:content-auth
# In a second terminal:
npm run dev:content
```

Configure the authentication host first; see the [development environment guide](../../docs/development-environment.md).
The app connects through its configured auth proxy. Installing the packages does not
configure OAuth, email delivery or a production database.

For a standalone local preview, run `npm run dev:preview --workspace @bitakit/content-demo`
and open `http://127.0.0.1:3102`. This development-only mode uses Better Auth's native memory
adapter. Register a temporary account through the normal sign-up form; accounts and
organizations disappear when the server restarts. The page labels this mode explicitly;
OAuth and email delivery are unavailable. Normal development still uses the auth proxy.

Discovery generates `src/bitakit.gen.tsx`, whose `BitaKitProvider` wraps the Next
integration with the discovered configuration. The host adds translation, language and
authentication plugins through its `additionalPlugins` option (`src/components/providers.tsx`).
Confirmed settings belong to Core; the discovered `settings-storage` service persists language
through the validated locale cookie and other settings through the standard browser storage.
Settings pages use App Preferences, with account settings at `/settings/account`, organization
settings at `/settings/organization` and appearance settings at `/settings/shell`.
Framework routes and workspace composition remain explicit application decisions.

Browser tests use an isolated Better Auth memory backend for authentication flows.
The discovery test supplies a test session to exercise HMR without adding a demo login
to the application. See `playwright.config.ts` for the local test server configuration.

For a new application, use the [generator](../../packages/create-app/README.md)
rather than copying this integration host and its provider-specific configuration.

## Better Auth UI in this demo

Moved from the `@bitakit/better-auth-ui` package README, which describes only the published package.

### Routes and local servers

Host configuration: `apps/content-demo/src/auth.tsx`.
The regular plugin contribution supplies the **Account & Organizations** menu link.

- `/better-auth`: public package entry points.
- `/better-auth/auth/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`,
  `/verify-email`, `/accept-invitation`, each under the same auth base path.
- `/better-auth/settings/account`, `/security`, `/organizations`.
- `/better-auth/organization/settings`, `/people`.
- Original UserButton, organization switcher and multi-account selection.

`npm run dev:content-auth` starts the existing web auth server on port 3101 and loads
the ignored local SMTP data. `npm run dev:content` starts the host on port 3102.
`FOUNDATION_AUTH_ORIGIN` controls the Next rewrite for `/api/auth/*`.
`BETTER_AUTH_TRUSTED_ORIGINS` explicitly allows the host origin;
`AUTH_UI_ORIGIN` sets the invitation target. The package contains no secrets.

### Verification

```text
npm run build --workspace @bitakit/better-auth-ui
npm test --workspace @bitakit/better-auth-ui
npm run test:e2e --workspace @bitakit/content-demo -- better-auth-ui.spec.ts
```

Package tests check the BitaKit lifecycle, native API pass-through, exports and isolated
real Better Auth flows. `tests/settings-pages.test.mjs` renders both settings pages in jsdom
against an isolated in-memory Better Auth handler and the demo organization backend. Browser
checks use the real imported components and an isolated real Better Auth handler instead of
invented responses.

### Teams and API keys

The running host enables native teams, including TeamSwitcher, and the native
API key extension. Teams: `/better-auth/organization/teams`. Personal keys:
`/better-auth/settings/security`. Organization keys:
`/better-auth/organization/settings`. This is management only; it does not by itself
make any domain API accessible with a key.

The server uses `@better-auth/api-key` with `default` (user) and
`organization` (organization). Organization keys remain subject to role and membership
checks; by default the owner has access. An API key does not replace the normal
session. New team creators are added to their team through the official AddTeamMember API,
so native team member management and selection are available immediately.
Existing organizations and teams are not migrated wholesale.

Migration `20260921010000_auth_teams_api_keys` adds only auth fields and
server-owned tables. RLS and revoked public table privileges also apply
to teams, team members and API keys. There is no generic CRUD exposure.
The open decision about the local 1.7.15 candidate remains unchanged.
