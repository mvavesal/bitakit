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

Discovery generates `src/bitakit.gen.tsx`, whose `BitaKitProvider` wraps the Next
integration with the discovered configuration. The host adds translation, preferences and
authentication plugins through its `additionalPlugins` option (`src/components/providers.tsx`).
Framework routes and workspace composition remain explicit application decisions.

Browser tests use an isolated Better Auth memory backend for authentication flows.
The discovery test supplies a test session to exercise HMR without adding a demo login
to the application. See `playwright.config.ts` for the local test server configuration.

For a new application, use the [generator](../../packages/create-app/README.md)
rather than copying this integration host and its provider-specific configuration.
