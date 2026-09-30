# Development environment

Use Node.js 24 and npm 10 or newer. Run `npm ci` from the repository root.
The documentation app runs independently with `npm run dev:docs`.

## Authenticated reference applications

Run `node scripts/setup-env.mjs` to create `apps/web/.env.local` from the example.
Existing files are preserved. Configure your own database connection, Better Auth
secret and application origin before starting the authenticated reference app.
The environment files are ignored by Git.

The web app uses Better Auth with a server-only ZenStack/Postgres adapter. Its
tracked migrations protect authentication tables with database RLS and revoked
public-role grants. Do not expose those tables through generic CRUD endpoints.

Database connections must verify TLS and hostname. Supply a trusted CA appropriate
to your database and configure `sslmode=verify-full` and `sslrootcert` as needed.
The existing public CA certificate is not a private key or a database credential.

```sh
npm run db:generate --workspace @bitakit/web
npm run db:status --workspace @bitakit/web
```

Apply tracked migrations only against your intended development database:

```sh
npm run db:migrate --workspace @bitakit/web
```

Never reset a shared database. Use a disposable development/shadow database when
creating migrations. OAuth and SMTP require explicit provider configuration;
installing the packages alone does not configure an account or send email.

The smaller Content Demo connects to the auth host through its configured proxy.
Use `npm run dev:content-auth` for the auth host and `npm run dev:content` for the
frontend. Consult each application's configuration for origins and ports.

## Verification

Run the relevant workspace's tests for a package change. The root `npm test` runs
the broader package suite, while `npm run check` builds packages and checks web
application types and lint. Neither command proves every external integration.

Browser tests use Playwright. Review each app's `playwright.config.ts` for its
server and port requirements. Tests that opt into real authentication/database
operations must use an isolated test environment, never production data.

## Repository hygiene

Keep local environment files, editor settings, generated clients, build output,
browser reports and scratch files out of commits. Retain source migrations,
public certificates, lockfiles and package-owned translation catalogs.
Code comments and new technical documentation are written in English; localization
catalogs and intentional language-test fixtures remain in their target languages.
