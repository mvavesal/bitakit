# Development environment

Use Node.js 24 and npm 10 or newer. Run `npm ci` from the repository root.
The documentation app runs independently with `npm run dev:docs`.

## Verification

Run the relevant workspace's tests for a package change. The root `npm test` runs
the broader package suite and `npm run verify:generated` checks freshly generated
apps. Neither command proves every external integration.

Tests that opt into real authentication/database operations must use an isolated
test environment, never production data. Never commit session files.

## Repository hygiene

Keep local environment files, editor settings, generated clients, build output,
browser reports and scratch files out of commits. Retain source migrations,
public certificates, lockfiles and package-owned translation catalogs.
Code comments and new technical documentation are written in English; localization
catalogs and intentional language-test fixtures remain in their target languages.
