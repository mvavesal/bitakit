# SaaS Foundation package structure standard

Status: proposed standard for the cleanup phase. Initial migration completed: Content Demo is a root module and Better Auth UI re-exports use upstream. Custom organization UI ownership is consolidated in better-auth-ui; native replacement remains separate. This document supersedes the earlier proposal to retain a separate organization UI in the organizations package.

## Shared structure

```text
packages/<name>/
├── package.json
├── README.md
├── tsconfig.json
├── src/
│   ├── index.ts                 # Public exports; no large implementation
│   ├── react.ts                 # Optional separate React entry point
│   ├── plugin.ts                # Plugin composition, where applicable
│   ├── contracts.ts             # Shared consumer contracts and types
│   ├── actions/
│   ├── services/
│   ├── configs/                 # Configuration data and defaults
│   ├── interceptors/
│   ├── providers/               # Context providers
│   ├── pages/                   # Host routing integration
│   ├── components/              # Necessary custom UI
│   ├── hooks/
│   ├── settings/                # Existing AppPreferences catalog integration
│   ├── upstream/                # Original library re-exports
│   └── internal/                # Precisely named shared private utilities
├── tests/
├── docs/
└── dist/                        # Generated output; never edit manually
```

This tree lists responsibilities, not mandatory directories. Create a path only when needed. Use `.tsx` for JSX. Small modules may stay directly under `src`; do not create a directory for every file.

## Naming and ownership

- Use kebab-case for files and directories. Avoid generic helpers, misc, or utils dumping grounds; names describe responsibilities.
- Keep index and react entry points focused on public exports.
- Avoid redundant suffixes within a contribution directory: `actions/refresh.ts` and `services/logging.ts`. Flat filenames remain equivalent under the Core convention.
- Action configuration belongs under `configs/actions/<action>.ts`. Renaming a file must not accidentally break a public ID.
- Config contains data. Inject Auth clients, React components, AppPreferences, and transports through explicit dependencies.
- Settings modules integrate with the existing settings system; they do not own a second preference store.
- Upstream modules re-export public library APIs; they do not copy library implementations.
- Keep feature-specific private helpers beside their feature. Internal must not become an unstructured catch-all.
- Preserve public package exports, plugin IDs, and shared service keys during internal moves.
- Each README describes responsibility, consumers, dependencies, public entry points, limitations, and validation.
- Write repository documentation, code comments, and development guidance in English, independently of the conversation language.

## Package boundaries

| Package | Responsibility |
| --- | --- |
| core | Runtime, Discovery, Actions, and Config; independent of Auth providers |
| app-preferences | Mutable user preferences, rendering and persistence |
| ui | Generic React bindings; no visual component library |
| next | Next.js integration |
| next-intl | Translation integration |
| email | Email service contract |
| nodemailer | Server-side email delivery implementation |
| better-auth | Headless authentication, organization, and email adapters |
| better-auth-ui | Better Auth UI integration, including organization UI and related settings |
| organizations | Headless contracts and services used independently today; reassess each responsibility |
| shell | Shared application shell, navigation, and settings integration |

All packages had consumers in the current audit. A small file count does not establish that a package is redundant.

## Better Auth UI

```text
better-auth-ui/src/
├── index.ts
├── plugin.tsx
├── contracts.ts
├── upstream/
│   ├── index.ts
│   ├── email.ts
│   ├── organization.ts
│   ├── two-factor.ts
│   ├── multi-session.ts
│   └── ...
├── providers/
│   └── auth.tsx
├── pages/
│   └── create-auth-pages.tsx
├── settings/
│   └── account-sections.tsx
└── components/
    ├── auth-page-layout.tsx
    └── organizations/           # Only necessary, approved customization
```

Prefer native components. Do not simply move all existing organization UI files here: compare each responsibility with native functionality first. Remove redundant implementations and retain only required, confirmed gaps. Map public `plugins/*` exports to the new upstream paths without breaking imports. UI extensions still require corresponding server Auth configuration and authorization.

## Better Auth and Organizations

Better-auth is not empty: it contains the Auth adapter, organization backend, session context integration, and email integration. These are headless responsibilities and remain outside better-auth-ui.

```text
better-auth/src/
├── index.ts
├── plugin.ts
├── services/
│   └── auth.ts
├── organizations.ts             # Preserve public entry point
├── organizations/
│   ├── backend.ts
│   └── session-backend.ts
├── email.ts                     # Preserve public entry point
└── email/
    └── auth-mail.ts

organizations/src/
├── index.ts
├── plugin.ts
├── contracts.ts
├── services/
│   └── organizations.ts
├── website.ts                   # Existing shared validation
└── demo.ts                      # Retain while consumed by the demo
```

Organization UI should have one owner in better-auth-ui. Both repository apps now use better-auth-ui/organizations; the former organizations/react entry point has been removed. External consumers must migrate that import and the stylesheet path. This target does not assert full native feature parity; the capability comparison is the first migration step.

## Justified exceptions

- UI retains directly importable, flat component modules.
- Email and next-intl may keep a single main file while small.
- Core and settings are infrastructure; do not turn them into artificial plugins to match the tree.
- A UI-only package may expose React from its main entry point. A mixed package must keep its headless entry independent of React.
- Enforce server/browser separation through actual entry points and exports; directory names alone are not a security boundary.

## Current discovery boundary

This structure does not automatically load published npm packages. Core currently discovers local modules; packaged plugins still use their existing factories. Place plugin.config.ts only at a module root actually connected to Discovery. Do not introduce a second scanner or registry.

## Migration sequence

1. Compare organization UI capabilities with Better Auth UI and record consumers.
2. Move Better Auth UI re-exports into upstream while preserving public exports.
3. Replace redundant UI with native components; retain only necessary customization in better-auth-ui.
4. Limit organizations to headless responsibilities after migrating consumers.
5. Split shell and large entry modules by responsibility while preserving behavior and the central theme.
6. Correct outdated documentation and tests, missing direct dependencies, and obsolete generated output.
7. Run relevant builds, type checks, and behavioral tests after each stage; keep the Foundation guide aligned.

## Next.js host exception

Application pages use native Next.js App Router files under `src/app`: page.tsx for routes and layout.tsx for shared shells. Do not create root pages.*.tsx contributions or route app pages through PluginPage. Independent plugins may contribute discovered pages through a host catch-all. Sharing contribution conventions does not mean replacing the host framework router.

Custom component ownership is recorded in [the component inventory](../../packages/better-auth-ui/CUSTOM_COMPONENTS.md). Existing custom/demo functionality remains explicitly separate from unchanged upstream exports.

## Minimal host application code

- Reuse the existing Foundation architecture and package APIs before adding host code. Keep application code limited to product behavior, native framework routes, and essential composition/configuration.
- Core already manages service registration, plugin lifecycle, and plugin-provided providers. The Better Auth adapter already registers the shared authentication service. Use these mechanisms; do not introduce a parallel registry, provider bootstrap, session store, or authentication binding in the app.
- Keep reusable provider-specific wiring in its optional adapter package, not Core or duplicated host files. Preserve server/client boundaries and explicit server configuration.
- Before adding host infrastructure, identify the concrete gap in existing package APIs. Moving boilerplate to another app folder is not simplification. Do not add wrappers or abstractions solely to reduce visible line count.
- Keep demo/catalog code separate from required application integration so it can be removed independently. Preserve native framework routing for app-owned pages.
- Write all new documentation, development guidance, and code comments in English, regardless of conversation language. Product localization catalogs are separate from this rule.

## Frontend generator tooling

`packages/create-app` follows the same small-module rule but ships Node `.mjs` sources
and native framework templates instead of a runtime plugin. CLI, orchestration, capability
selection and framework adapters have separate responsibilities. Next.js and experimental TanStack Start are exposed; framework dependencies stay in
their optional adapters. UI shares visual composition and Core shares Node discovery.
