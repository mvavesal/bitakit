<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/docs/public/brand/bitakit-logo-dark.png">
    <img src="apps/docs/public/brand/bitakit-logo.png" alt="BitaKit" width="300" height="130">
  </picture>
</p>

# BitaKit

**A modular app framework. Build your product; compose the foundation.**

BitaKit brings together Actions, typed services, plugins, settings and optional application
surfaces. Start with a small frontend and add the capabilities your product needs.
Your application owns its business logic and native framework routes.

[Quick start](apps/docs/content/docs/quickstart.mdx) ·
[Packages](packages/README.md) ·
[Generator](packages/create-app/README.md) ·
[Contributing](apps/docs/content/docs/contributing.mdx) ·
[Roadmap](docs/TODO.md)

> **Pre-release:** BitaKit is under active development. The source packages currently use
> `@bitakit/*`; public npm publication is pending. Public installation
> examples describe the intended release workflow, not an available npm release.

## What you can build with

- **Headless runtime:** Actions, plugin lifecycle, typed services and configuration without React in Core.
- **React integration:** shared providers, reactive bindings and optional themed components.
- **Framework adapters:** Next.js and experimental TanStack Start integration, each using the host router.
- **Optional capabilities:** App Preferences, Shell, Quick Search, translations, authentication and organizations.
- **Server integrations:** an email contract and Nodemailer SMTP implementation, separate from browser code.
- **A small generator:** native framework scaffolding with installed packages instead of copied plugin implementations.

Plugins own their behavior and translation catalogs. Applications compose them and can
override translations. Third-party plugins can live in their own repositories and use
BitaKit's public contracts; they do not need to be added to this monorepo.

## Explore the documentation

Requirements: **Node.js 24** and **npm 10 or newer**.

```sh
git clone https://github.com/mvavesal/bitakit.git
cd bitakit
npm ci
npm run dev:docs
```

Open [localhost:3002/docs](http://localhost:3002/docs) for searchable guides.
The repository is currently private, so cloning requires access. The documentation
site is a separate Fumadocs application and does not require a database.

To generate an application before npm publication, follow the generator's
[local package workflow](packages/create-app/README.md#verify-before-publication).
The [quick start](apps/docs/content/docs/quickstart.mdx) presents the intended
application-developer experience.

## Repository map

| Directory                            | Purpose                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| `packages/core`                      | Framework-independent runtime, Actions and Node-only discovery     |
| `packages/ui`                        | React bindings and optional standard components                    |
| `packages/next`, `packages/tanstack` | Optional framework integrations                                    |
| `packages/create-app`                | Frontend generator                                                 |
| Other `packages/*`                   | Optional capabilities and provider integrations                    |
| `apps/docs`                          | Developer documentation                                            |
| `apps/content-demo`                  | Smaller integration host                                           |
| `apps/web`                           | Reference application with authentication and database integration |
| `docs`                               | Architecture notes and roadmap                                     |
| `scripts`                            | Workspace and verification tools                                   |

See the [package guide](packages/README.md) for individual responsibilities.

## Working on BitaKit

```sh
npm run build:actions   # Build the runtime and integration packages
npm run dev:content    # Start the smaller Next.js integration host
npm run dev:web        # Start the reference web application
npm run build:docs     # Build the documentation site
```

The authenticated examples need their own server configuration. Use
`apps/web/.env.example` as the starting point; `node scripts/setup-env.mjs` creates
an ignored local file without overwriting existing values. Supply your own database
and provider configuration. Never commit credentials or use production data for tests.
See the [database and authentication guide](docs/development-environment.md).

Validation should match the change:

```sh
npm run test --workspace @bitakit/core  # Example: runtime tests
npm run check                                # Package builds, web types and lint
npm run format:check                         # Formatting without changes
```

`npm test` runs the broader package suite. Browser and external-service tests have
additional setup requirements; consult the relevant application's configuration
before running them.

## Current boundaries

- TanStack Start support is **experimental**; see its [verified scope](packages/tanstack/README.md).
- The Next.js generator uses Webpack while the tracked Turbopack discovery issue is open.
- Plugin discovery is not a marketplace, remote installer or sandbox for untrusted code.
- Authentication and database-backed examples require explicit server configuration.
- Public npm publication, hosted documentation and the project license decision are still pending.

## Contributing and licensing

Keep changes focused, preserve the package boundaries, and document public behavior
in English. Start with the [contributor guide](apps/docs/content/docs/contributing.mdx)
and the nearest `AGENTS.md` before changing a package or application.

A project-wide license has not yet been selected. Dependency notices are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); they do not license BitaKit itself.
