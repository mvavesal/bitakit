# Hand-off: remaining work for Phases 5 and 6

This document lists what is left after the base implementation of Phase 5, in enough detail
for another agent to continue without the conversation history. Read `AGENTS.md`,
`.agents/skills/foundation-development/SKILL.md`, `docs/target-api.md` and
`refactor-phases.md` first. Work on branch `refactor/dx`. Keep every change within the rules
of the skill: one documented way per concept, English only, central components, tests next
to the code, no new deprecated helpers.

Verification commands: `npm test` (every package), `npm run verify:generated` (generated apps,
slow), `npm run check:css`, `npm run build:docs`. Run the ones relevant to the change.

## State after the base implementation (done)

- Phases 0 to 4 are complete and committed; the API contract in `docs/target-api.md` is the
  source of truth.
- Phase 5 base: the deprecated shims are removed (`packages/core/src/compat.ts`, the object
  form of `defineService`, action `resolve`/`watch`, `publicServices`, `appExtensions`, the
  top-level `pages`/`views`/`providers` plugin fields, `events.watch`, `useWatchEvent`,
  `withFoundation`, `@bitakit/next/generated`, `@bitakit/tanstack/generated`,
  `createFoundationConfig`, `foundation.config.ts` loading). `bitakit migrate` still rewrites
  the old spellings; `bitakit doctor` still names them. `bitakit add` covers action, service,
  page, interceptor, config, events, settings, layout, slot, dialog and provider.
- The sample apps `apps/web` and `apps/content-demo` are intentionally NOT migrated (the
  owner decided they are unimportant samples). `apps/web` currently fails `bitakit generate`
  because its `bitakit.config.ts` imports the removed `settingsDiscovery`.

## Phase 5: complementary tasks

### 5.1 Adapter kit (`defineFramework`) and router contract

Goal: `@bitakit/next` and `@bitakit/tanstack` share one implementation; a third framework
needs only a router adapter.

- Add to `@bitakit/ui` a router contract type:
  `Router = { pathname: string; params: Record<string, string>; navigate(href, { replace? }); subscribe(listener): () => void; Link: ComponentType<{ href; replace?; children }> }`.
  Today `UIContext` carries `pathname`, `Link` and `navigate` (see
  `packages/ui/src/providers/action-context.ts` and `hooks/use-foundation-navigation.ts`).
  Extend it with `params` and `subscribe`, keep the old names working.
- Add `defineFramework({ id, router: () => Router, routes?: { catchAll, settings } })` in
  `@bitakit/ui` (or a new small package) returning the `FoundationProvider` wrapper the
  adapters export today (`packages/next/src/providers/foundation-provider.tsx`,
  `packages/tanstack/src/providers/foundation-provider.tsx`). Rebuild both adapters on it; the
  generated `BitaKitProvider` keeps its signature.
- Route emission for Next (optional, after the above): `bitakit generate` writes the catch-all
  `app/[...path]/page.tsx` and `app/settings/[[...section]]/page.tsx` when they are missing and
  `routes.emit` is enabled in `bitakit.config.ts`. The client catch-all (`PluginPage`) stays
  the fallback. Add doctor checks for both files.

Files: `packages/ui/src/providers/*`, `packages/next/src/*`, `packages/tanstack/src/*`,
`packages/core/discovery/generate.mjs` (route emission), `packages/cli/src/doctor.mjs`.

### 5.2 Zero-argument package plugins with contracts

Goal: `packagePluginN(options)` in the generated file disappears; every package plugin is
`definePlugin`-shaped and receives host objects through contracts.

- Shell, App Preferences and Quick Search already take only options from
  `src/configs/<name>.ts`. Keep that.
- `@bitakit/better-auth`: replace `betterAuthPlugin(client, options)` with a plugin that
  `requires: ['auth.client']`; the host provides the Better Auth client as a service
  (`src/services/auth-client.ts` with `provides: betterAuthClient`), and `paths`/`signIn` come
  from `configs/better-auth.ts`.
- `@bitakit/organizations`: the backend arrives through a contract
  (`provides: organizationBackend`), the plugin reads it in its service factory.
- `@bitakit/next-intl`: `useNextIntlPlugin()` becomes a provider under `ui/providers` plus a
  service with `provides: translationService`; `languagePreferences` stays.
- `@bitakit/better-auth-ui`: `provider` options move to `configs/better-auth-ui.ts`; the
  `pageLayout` hooks disappear once Shell page layouts (`export const layout`) cover the
  cases content-demo used.
- Update `packages/core/discovery/packages.mjs` and `generate.mjs` so a package manifest may
  declare `"bitakit": { "plugin": "./foundation", "configuration": "<name>", "dependencies": ["app-preferences"] }`
  and the generator emits plugin `dependencies` from it (the Phase 4 item that was deferred).
- `bitakit build` must cover `ui/` of plugin packages (JSX, `'use client'`), see
  `packages/cli/src/build.mjs`.

### 5.3 Tooling

- `bitakit doctor --json` (machine-readable results) and two new checks: a wiring check that
  every `requires` contract has a provider in the composition, and a graph check that reports
  plugin dependency cycles and plugins nobody activates.
- `bitakit init` for existing apps (writes `bitakit.config.ts`, the provider in the root
  layout, the catch-all route) sharing templates with `create-app`
  (`packages/create-app/src/project-files.mjs`).
- `create-app`: offer `preferences` without `shell` (the settings route already follows the
  `preferences` feature), add `<ShellThemeScript />` to the generated root layout when Shell
  is selected.

### 5.4 Testing helpers (`@bitakit/core/testing`, `@bitakit/ui/testing`)

- `mountPlugin` reads `plugin.config.ts` (id, dependencies, metadata) and the generated maps
  when present, so `runtime.actions.execute('todos.add')` is typed in tests.
- `renderWithFoundation(element, { plugins, services, settings })` in `@bitakit/ui/testing`:
  jsdom mount with `FoundationProvider`, `act` wrapped, returns `runtime`, `container`,
  `unmount`. Base it on `packages/ui/tests/support.mjs`.
- An event recorder (`events.recorded` exists in `mountPlugin`; expose the same for
  `renderWithFoundation`).

### 5.5 Package hygiene

- Move `packages/core/discovery/*.mjs` and `packages/core/testing` into a new package
  `@bitakit/discovery` so `typescript` and `jiti` leave Core's runtime dependencies. Keep
  `@bitakit/core/discovery` as a re-export for one release with `@bitakit/discovery` as an
  optional peer dependency; update `@bitakit/next/config`, `@bitakit/tanstack/config`,
  `@bitakit/cli`, `@bitakit/create-app`, `scripts/verify-generated.mjs` and the tests.
- `@bitakit/ui` must declare `zustand` (it re-exports Core's store helpers); align
  `@bitakit/next` and `@bitakit/tanstack` peer ranges with `@bitakit/ui`.
- Remove the `foundation` manifest key fallback in `packages.mjs` after the apps are rebuilt.

## Phase 6: docs, AI guidance and reference apps

### 6.1 Rebuild the sample apps on the new conventions

Prefer replacing the hand-written settings code with the generated path:

- `apps/web`: delete `src/settings/**`, `src/components/settings/base/**`,
  `src/components/providers/settings-provider.tsx`, `src/services/{theme,locale}.ts`,
  `src/actions/{theme,locale}/`, `src/contributions/renderers/`, the `kinds:` entry in
  `bitakit.config.ts`, the `appPreferencesPlugin({ settings })` call in
  `src/components/providers/bitakit.tsx`. Add `src/settings.ts` with
  `defineSettings({ theme: setting({ default: 'system', options: [...], control: 'cards' }), locale: setting({ default: 'en', options: [...], control: 'select' }) })`,
  a `src/services/settings-storage.ts` with `provides: settingsStorage` that routes `theme`
  and `locale` to the existing server actions (`src/settings/server/actions.ts`, keep and
  adapt them to read scope and parse from `src/settings.ts`) and everything else to
  `createLocalSettingsStorage()`. Mount `SettingsRoute` from `@bitakit/app-preferences` in
  `app/settings/[[...section]]/page.tsx`; keep the intercepted dialog with
  `SettingsShell embedded` and `SettingsPage`. Theme application: a client component that
  calls `setThemePreference` from `useSetting('theme')`, replacing the old provider effects.
  The demo plugin gets `ui/settings/page.tsx` instead of its setup registration. Update
  `e2e/platform.spec.ts` and `tests/actions-locale.test.mjs`. Section paths from packages:
  `/settings/account`, `/settings/organization?tab=members`, `/settings/plugins`.
- `apps/content-demo`: `configs/shell.ts` becomes `{ groups: ['navigation'] }`; providers use
  a `settings.storage` service wrapping `createLocalSettingsStorage({ prefix: 'content-demo.settings.' })`
  with `language.storage(...)` from `@bitakit/next-intl/preferences`; `auth.tsx` drops
  `accountSettings`; `workspace-layout.tsx` imports `SettingsShell` from
  `@bitakit/app-preferences` and passes brand/account through `AppShell` props or slots;
  `settings/[section]/page.tsx` uses `SettingsPage` from `@bitakit/app-preferences`; root
  layout adds `<ShellThemeScript />`. Update `e2e/better-auth-ui.spec.ts` paths.
- Alternatively replace `apps/web` with the generated sample plus the auth and organizations
  packages, as `refactor-phases.md` allows.

### 6.2 Documentation

- One conventions source generates the AGENTS.md section in `create-app`
  (`packages/create-app/src/project-files.mjs`, `agentRules`) and the docs-site conventions
  page; today they are written twice.
- Collapse the three documentation sets (`apps/docs`, `packages/core/docs`, repo `docs/`).
  Move resolved review episodes from the skill to `REVIEW.md`. Translate the German READMEs.
- Write the 0.1 to 0.2 migration guide around `bitakit migrate` (what it rewrites, what it
  cannot: settings definitions, Shell options, Better Auth UI options).
- Remove the German rules from `AGENTS.md` that only concern the sample apps once those are
  rebuilt, and shorten the file to the durable rules.

### 6.3 Release

- Bump every package to 0.2.0, run `npm test`, `npm run verify:generated`,
  `npm run build:docs`, `npm run check:css`, then publish in dependency order (Core first).

## Order of work and estimated effort

1. 5.5 package hygiene and 5.3 tooling (small, mechanical).
2. 5.4 testing helpers (small).
3. 5.2 zero-argument package plugins (medium; touches better-auth, organizations, next-intl,
   better-auth-ui and the generator).
4. 5.1 adapter kit (medium to large).
5. 6.1 sample apps (large; can run in parallel with 5.1 by a second agent).
6. 6.2 documentation and 6.3 release (medium).
