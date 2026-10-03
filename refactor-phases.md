# Refactor phases

Date: 2026-10-02. Branch: `refactor/dx`. Rationale and evidence: [docs/dx-review.md](docs/dx-review.md).

Goal: one documented way for every concept, frontend first, with a structure that keeps the
same shape on the server later. Phases 1 and 2 are breaking and ship together as the 0.2
release with a codemod. Every phase leaves the repository working. Sizes are relative (S, M, L).

## Parity rules (fixed before Phase 1)

These rules make the later server side cheap. They are enforced from the first phase even
though `server/` stays empty until Phase 7.

1. Every headless primitive takes one context object with the same keys everywhere:
   `({ services, config, events, store, settings })`. The server later adds a request `ctx`
   as a method argument, nothing else.
2. React only under `ui/`, Node only under `server/`. A lint rule and a `doctor` check enforce it.
3. Shared files are isomorphic by construction: `events.ts`, `settings.ts`, `config.ts`.
4. Services are the unit of logic on both sides. Actions exist only on the client.
   Interceptors have one shape.
5. One generator writes `src/bitakit.gen.ts` now and `src/bitakit.server.gen.ts` later.
6. One error model: a startup error always names the plugin and the file.

## Phase 0: Freeze and decide (S)

- [x] Commit the open files on `feat/dx-overhaul` or stash what is unfinished. Everything
      below starts from a clean tree.
- [x] Decide names once: BitaKit everywhere, `bitakit.config.ts`, `src/bitakit.gen.ts`, no
      "Foundation" in generated output. Keep the npm package names; `@bitakit/ui` becomes
      React-only.
- [x] Write the target API as a two-page spec and draft the generated AGENTS.md from it. The
      AGENTS.md is the acceptance test: a convention that does not fit on that page is too
      complicated.

## Phase 1: Core consolidation, headless only (L)

Changes

- [x] `defineAction` is the single action shape. `href` and `dialog` are options. Presentation
      fields (`title`, `enabled`, `visible`, `icon`, ...) accept a value or a function that is
      re-evaluated when a service it reads changes.
- [x] `defineService` factory receives `store`. Services are namespaced `<plugin>.<file>` by
      default; `exposeAs` only flattens deliberately. `provideService` folds into
      `provides: contract`. Optional `start`/`stop`; `mount()` returns a `ready` promise.
- [x] `defineEvents` per plugin: auto-prefixed names, owner-only emit, optional `cancelable`
      events whose `emit` returns `Promise<boolean>`.
- [x] `defineInterceptor` with an `action` or `service` target (mutually exclusive, glob
      matching, plugin-local by default), `before`/`after`/`onError`, `order`, `scope`.
- [x] `defineConfig({ schema, defaults })` as the one form. `config.plugin.get` and
      `config.action.get` are typed from the generated map.
- [x] Every startup error is a `FoundationStartupError` with plugin ID, file and the offending
      identifier in the message (duplicate IDs, cycles, duplicate pages, invalid hrefs).
- [x] Feedback defaults: silent success, one failure toast, `<id>.success` / `<id>.failure`
      locale keys picked up automatically, `success: false` for silence, `confirm` option
      routed through the host confirmation.
- [x] Pending is set only when `execute` returns a promise. `concurrency: 'exclusive' |
'per-input' | 'latest'` with an abort `signal` in the handler context.

Removes

- [x] Curried `defineAction<Input>()` builder, class and factory action discovery,
      `defineURLAction`, `defineDialogAction`, `defineFormAction` (form fields and
      `validateFields` leave Core).
- [x] `resolve`, `watch`, `events` + `onEvent`, `setup`, `initialState`, `state`, `dependsOn`,
      `conventions`, `configPath`, `unavailable`, `replaces` (overrides move to
      `bitakit.config.ts`).
- [x] `defineActionInterceptor`, `defineServiceInterceptor`, the legacy `defineInterceptor`
      branch.
- [x] `publicServices`, `discoverPublicServices`, the raw-key entries in `ServiceMap`.

Done when

- Core tests pass on the new shape, `examples/todos` runs, `mountPlugin` works, and the public
  export list of `@bitakit/core` is under 15 names.
- _Status 2026-10-03: 171 Core tests pass; the example and `mountPlugin` work. The developer-facing
  helpers are 11 (`defineService`, `defineAction`, `definePlugin`, `defineEvents`, `event`,
  `defineInterceptor`, `defineConfig`, `defineContract`/`serviceKey`, `createStore`,
  `createRuntime`, `getService`); runtime and integration exports stay on the root entry and
  move to a subpath in Phase 5._

## Phase 2: Discovery and generated output (M)

Changes

- [x] One filename convention: folders only (`actions/add.ts`). `bitakit migrate` rewrites
      the suffix and dotted forms. The repo apps are migrated with it.
- [x] `ui/` folder for `pages/`, `slots/`, `dialogs/`, `providers/`. Slot and page identity
      come from the filename; no `definePage` / `defineView`. `server/` is reserved and skipped.
- [x] Real generated files instead of a bundler alias: `src/bitakit.gen.ts` and
      `src/bitakit.gen.d.ts` with `ActionMap`, `ServiceMap`, `EventMap`, `ConfigMap`,
      `SlotMap`. Strict action IDs on by default in generated apps.
- [x] `bitakit.config.ts` replaces `foundation.config.ts`. `plugin.config.ts` only for
      `dependencies` and metadata. _Deferred to Phase 5: deriving plugin dependencies from
      service and event usage._
- [x] Warnings for skipped files (no default export, `-` prefix). Integration kinds move
      under `contributions/<kind>/` so `settings/`, `sections/`, `renderers/`, `providers/`
      are no longer reserved at the app root.
- [x] Watcher: ignore `.tanstack`, `.output`, `coverage`; platform-independent ignore
      pattern; single generation at dev start.
- [ ] `bitakit info --graph` (plugins, services, events, who uses what). _Deferred; `info --json`
      exists._

Done when

- The generated sample app type-checks with zero hand edits, and Turbopack works because
  nothing is aliased.
- _Status 2026-10-03: fresh Next and TanStack samples generate and type-check against the
  workspace packages, and the generated file has no bundler alias. A browser run under
  Turbopack has not been performed yet._

## Phase 3: React bindings (M)

Changes

- [x] `useAction(id, input)` returns state plus prop getters: `props()`, `linkProps()`,
      `checkedProps()`, `valueProps()`, `menuItemProps()`. Getters merge user props.
- [x] `<Action id input kind>` merges into its child (Slot pattern); render-prop form kept
      for full control. `ActionButton` stays as sugar on top of `<Action>`.
- [x] `useActionGroup(group)` for menus and navigation. Provider-level `controls` adapters
      map state to library-specific prop names.
- [x] `useService`, `useServiceState(name, selector?)`, `useEvent`. Readiness is handled inside
      the hooks; `app.optional.services` disappears.
- [x] Pending passed as a prop (`pending`), never a swapped label. Per-input pending reaches
      `useAction(...).pending`.
- [x] One `FoundationProvider` with defaults. Plugins merge by ID; replacement only when
      explicit. Required `ui`/`labels` props removed.

Removes

- [x] `ActionCheckbox`, `ActionRadioGroup`, `ActionMenuItem`, `ActionBinding`,
      `ActionGroupBinding`, `ActionMenuView`, `useRegisterAction(s)`, the `[key: string]: unknown`
      index signature. _Kept as sugar or deprecated aliases: `ActionLink`, `useWatchEvent`,
      `useFoundationReady`._

Done when

- The sample Todos page is written with `useServiceState` and `<Action>` only, and the
  startup-isolation tests pass with attributed errors.
- _Status 2026-10-03: done; 49 UI tests including startup isolation with async `onStart`
  failures pass. `ActionLink`, `useWatchEvent` and `useFoundationReady` remain as sugar or
  deprecated aliases._

## Phase 4: Settings and Shell (L)

Status 2026-10-03: packages done (Core, UI, app-preferences, Shell, better-auth-ui,
next-intl, quick-search, CLI, create-app); the sample apps are left for the Phase 6 rebuild.

Changes

- [x] `defineSettings` per plugin: `setting({ default, schema?, scope: 'user' | 'organization' |
      'device', label?, control?, options? })` in an isomorphic `settings.ts`. Keys are
      `<plugin>.<name>`; app settings keep plain names. The runtime owns values
      (`SettingsStore`), identity follows the `auth` contract.
- [x] One read/write API: `settings.<plugin>.<name>.get() / set() / subscribe()` in every
      context and `useSetting(key)` in React. Generated settings pages from the declarations
      (`useSettingsCatalog`, App Preferences renders them); `ui/settings/page.tsx` replaces a
      plugin's page; sections take `title`, `category`, `order`, `path`, `shortcut`.
- [x] Storage is the `settings.storage` contract; browser storage is the default; a host
      provides a server-backed service in one file (`provides: settingsStorage`).
- [x] Shell split into headless hooks (`useNavigation`, `useSlot`, `useSettingsCatalog`,
      `useNotifications`, `useCurrentPage`) and compound `AppShell.*` components with a
      `components` override map.
- [x] Declared `slots` (package manifests `bitakit.slots` and `bitakit.config.ts`) generate
      `SlotMap`. `doctor` warns when a slot file targets a slot no layout declares.
- [x] Layouts discovered from `src/layouts/<name>.tsx`; pages choose with
      `export const layout = 'admin'`; `blank` renders nothing around the page; unknown
      names fail at startup with attribution.
- [x] Shell options via a schema (`shellOptions`, `{ groups, presets }`); features derive from
      contributions; the boolean switches are gone. Notifications are an always-on service.
- [x] Theme: appearance settings (`mode`, `layout`, `preset`, `density`, `corners`, `toasts`)
      owned by Shell and applied to `<html>` (`dark`, `data-theme-preset`, `data-density`,
      `data-shell-corners`); presets are CSS the host or a package ships, listed in
      `configs/shell.ts`. `ShellThemeScript` pre-paints the color scheme.
- [ ] Package manifests declare plugin `dependencies` (transitive activation already follows npm
      dependencies; an explicit manifest field is deferred to Phase 5).
- [x] Dialog frames: `dialog: { component, kind, size }`; hosts register frames through
      `FoundationProvider` `dialogs` and decide the appearance.

Removes

- [x] `SettingsSection`, `defineSettingsSection`, the `settings` / `settings.sections` /
      `settings.renderers` kinds, the App Preferences store and renderer registry, the Shell
      option plumbing, `@bitakit/shell/settings|definitions|sidebar`.
- [ ] `theme.set` and `locale.set` in `apps/web` and the demo plugin's hand-written settings link
      go with the Phase 6 rebuild of the sample apps.

Done when

- A custom layout written only with the hooks renders every plugin contribution (Shell test
  `app-shell.test.mjs`), and the generated apps verify end to end (`verify:generated`).
  `apps/web` still contains its pre-Phase-4 settings catalog until the Phase 6 rebuild.

## Phase 5: Adapters, packages and tooling (M)

Status 2026-10-03: complete. Open follow-ups are listed in `docs/handoff-phases-5-6.md`
(the `foundation` manifest-key fallback goes with the Phase 6 sample-app rebuild).

Changes

- [x] Adapter kit: `defineFramework({ id, useRouter, QueryState })` in `@bitakit/ui`; Next and
      TanStack are one call each. Route files for existing apps come from `bitakit init`; the
      client catch-all stays the fallback.
- [x] Router contract: `pathname`, `params`, `navigate(href, { replace })`, `Link`; values
      follow React renders, so no `subscribe`.
- [x] Package plugins are zero-argument factories; host objects arrive through contracts:
      `better-auth-client` (`{ client }`) for Better Auth, `organization-backend` for
      organizations, next-intl is a plugin with a `ui/providers` bridge, better-auth-ui reads
      `configs/better-auth-ui.ts`; Shell, App Preferences and Quick Search read their config
      files. Manifests declare `bitakit.dependencies`; `bitakit build` compiles `ui/`.
- [x] `create-app` writes the new shape and `bitakit init` wires an existing Next or TanStack
      app. `bitakit add` covers every kind and nested paths. `doctor` has wiring and graph
      checks and `--json`.
- [x] Testing: `mountPlugin` reads `plugin.config.ts` and types `execute` by action ID;
      `renderWithFoundation` in `@bitakit/ui/testing` with an event recorder.
- [x] Package hygiene: discovery lives in `@bitakit/discovery`, so `typescript` and `jiti`
      left Core's runtime dependencies (`@bitakit/core/discovery` re-exports it for one
      release; `@bitakit/discovery` is an optional peer of Core); `@bitakit/ui` already declares
      zustand and the `react` peer ranges of `@bitakit/next` and `@bitakit/tanstack` match
      `@bitakit/ui`.
- [x] Deprecated shims removed: `compat.ts`, the object form of `defineService`, action
      `resolve`/`watch`, `publicServices`, `appExtensions`, top-level `pages`/`views`/
      `providers`, `events.watch`, `useWatchEvent`, `withFoundation`, the `generated` adapter
      entries, `createFoundationConfig`, `foundation.config.ts` loading. `bitakit migrate`
      and `doctor` keep their migration diagnostics.

Done when

- `scripts/verify-generated.mjs` passes for all generated shapes, and no package needs a
  hand-written provider in the host.

## Phase 6: Docs, AI guidance and reference apps (M)

- [ ] One conventions source generates AGENTS.md and the docs-site conventions page.
- [ ] Collapse the three documentation sets (docs site, `packages/core/docs`, repo `docs/`).
      Trim `.agents/skills/foundation-development/SKILL.md` to durable rules in English; move
      review history to REVIEW.md. Translate the German package READMEs.
- [ ] Rebuild the `apps/web` demo code on the new conventions, or replace it with the generated
      sample plus the auth and organizations packages. `apps/content-demo` uses the same path.
- [ ] Migration guide for 0.1 → 0.2 and the `bitakit migrate` codemod.
- [ ] Publish 0.2.

Done when

- The README walkthrough, the generated app, the CLI templates and the showcase apps describe
  the same framework, and the generated AGENTS.md fits on one screen.

## Phase 7 (later): Server side (L)

- [ ] `server/` discovery and `src/bitakit.server.gen.ts` from the same generator.
- [ ] Server runtime on the unchanged Core; `start`/`stop`; attributed startup errors.
- [ ] Typed bridge: client services call server services through a generated proxy over one
      framework entry (Next route handler first).
- [ ] Move the hand-written server halves of auth, organizations and email into their plugins
      and delete the host code.

Done when

- No new primitive was needed except the bridge. If one was, a parity rule was broken earlier.

## Working rules

- Build the codemod in Phase 1 alongside the API changes and run it on `apps/web`
  continuously, so the repo dogfoods the migration instead of discovering it at the end.
- Regenerate AGENTS.md at the end of every phase. If a phase makes it longer, the phase added
  complexity rather than removed it.
- Each phase ends with the full test chain and `verify-generated.mjs` green.
