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

- [ ] Commit the open files on `feat/dx-overhaul` or stash what is unfinished. Everything
      below starts from a clean tree.
- [ ] Decide names once: BitaKit everywhere, `bitakit.config.ts`, `src/bitakit.gen.ts`, no
      "Foundation" in generated output. Keep the npm package names; `@bitakit/ui` becomes
      React-only.
- [ ] Write the target API as a two-page spec and draft the generated AGENTS.md from it. The
      AGENTS.md is the acceptance test: a convention that does not fit on that page is too
      complicated.

## Phase 1: Core consolidation, headless only (L)

Changes

- [ ] `defineAction` is the single action shape. `href` and `dialog` are options. Presentation
      fields (`title`, `enabled`, `visible`, `icon`, ...) accept a value or a function that is
      re-evaluated when a service it reads changes.
- [ ] `defineService` factory receives `store`. Services are namespaced `<plugin>.<file>` by
      default; `exposeAs` only flattens deliberately. `provideService` folds into
      `provides: contract`. Optional `start`/`stop`; `mount()` returns a `ready` promise.
- [ ] `defineEvents` per plugin: auto-prefixed names, owner-only emit, optional `cancelable`
      events whose `emit` returns `Promise<boolean>`.
- [ ] `defineInterceptor` with an `action` or `service` target (mutually exclusive, glob
      matching, plugin-local by default), `before`/`after`/`onError`, `order`, `scope`.
- [ ] `defineConfig({ schema, defaults })` as the one form. `config.plugin.get` and
      `config.action.get` are typed from the generated map.
- [ ] Every startup error is a `FoundationStartupError` with plugin ID, file and the offending
      identifier in the message (duplicate IDs, cycles, duplicate pages, invalid hrefs).
- [ ] Feedback defaults: silent success, one failure toast, `<id>.success` / `<id>.failure`
      locale keys picked up automatically, `success: false` for silence, `confirm` option
      routed through the host confirmation.
- [ ] Pending is set only when `execute` returns a promise. `concurrency: 'exclusive' |
      'per-input' | 'latest'` with an abort `signal` in the handler context.

Removes

- [ ] Curried `defineAction<Input>()` builder, class and factory action discovery,
      `defineURLAction`, `defineDialogAction`, `defineFormAction` (form fields and
      `validateFields` leave Core).
- [ ] `resolve`, `watch`, `events` + `onEvent`, `setup`, `initialState`, `state`, `dependsOn`,
      `conventions`, `configPath`, `unavailable`, `replaces` (overrides move to
      `bitakit.config.ts`).
- [ ] `defineActionInterceptor`, `defineServiceInterceptor`, the legacy `defineInterceptor`
      branch.
- [ ] `publicServices`, `discoverPublicServices`, the raw-key entries in `ServiceMap`.

Done when

- Core tests pass on the new shape, `examples/todos` runs, `mountPlugin` works, and the public
  export list of `@bitakit/core` is under 15 names.

## Phase 2: Discovery and generated output (M)

Changes

- [ ] One filename convention: folders only (`actions/add.ts`). `bitakit migrate` rewrites
      the suffix and dotted forms. The repo apps are migrated with it.
- [ ] `ui/` folder for `pages/`, `slots/`, `dialogs/`, `providers/`. Slot and page identity
      come from the filename; no `definePage` / `defineView`. `server/` is reserved and skipped.
- [ ] Real generated files instead of a bundler alias: `src/bitakit.gen.ts` and
      `src/bitakit.gen.d.ts` with `ActionMap`, `ServiceMap`, `EventMap`, `ConfigMap`,
      `SlotMap`. Strict action IDs on by default in generated apps.
- [ ] `bitakit.config.ts` replaces `foundation.config.ts`. `plugin.config.ts` only for
      `dependencies` and metadata. Plugin dependencies are derived from service and event
      usage where the build can see them.
- [ ] Warnings for skipped files (no default export, `-` prefix). Integration kinds move
      under `contributions/<kind>/` so `settings/`, `sections/`, `renderers/`, `providers/`
      are no longer reserved at the app root.
- [ ] Watcher: ignore `.tanstack`, `.output`, `coverage`; platform-independent ignore
      pattern; single generation at dev start.
- [ ] `bitakit info --graph` (plugins, services, events, who uses what).

Done when

- The generated sample app type-checks with zero hand edits, and Turbopack works because
  nothing is aliased.

## Phase 3: React bindings (M)

Changes

- [ ] `useAction(id, input)` returns state plus prop getters: `props()`, `linkProps()`,
      `checkedProps()`, `valueProps()`, `menuItemProps()`. Getters merge user props.
- [ ] `<Action id input kind>` merges into its child (Slot pattern); render-prop form kept
      for full control. `ActionButton` stays as sugar on top of `<Action>`.
- [ ] `useActionGroup(group)` for menus and navigation. Provider-level `controls` adapters
      map state to library-specific prop names.
- [ ] `useService`, `useServiceState(name, selector?)`, `useEvent`. Readiness is handled inside
      the hooks; `app.optional.services` disappears.
- [ ] Pending passed as a prop (`pending`), never a swapped label. Per-input pending reaches
      `useAction(...).pending`.
- [ ] One `FoundationProvider` with defaults. Plugins merge by ID; replacement only when
      explicit. Required `ui`/`labels` props removed.

Removes

- [ ] `ActionLink`, `ActionCheckbox`, `ActionRadioGroup`, `ActionMenuItem`, `ActionBinding`,
      `ActionGroupBinding`, `ActionMenuView`, `useWatchEvent` (renamed `useEvent`),
      `useFoundationReady` (internal), the `[key: string]: unknown` index signature.

Done when

- The sample Todos page is written with `useServiceState` and `<Action>` only, and the
  startup-isolation tests pass with attributed errors.

## Phase 4: Settings and Shell (L)

Changes

- [ ] `defineSettings` per plugin: `schema`, `default`, `scope: 'user' | 'organization' |
      'device'`, optional `label` and `render`. Keys are `<plugin>.<name>`.
- [ ] One read/write API: `settings.<plugin>.<key>.get() / set() / subscribe()` and
      `useSetting(key)`. Generated settings sections from the definitions;
      `ui/settings/page.tsx` replaces a plugin's section.
- [ ] Storage is a `settings.storage` contract; browser storage is the default; a host
      provides a server-backed service in one file.
- [ ] Shell split into headless hooks (`useNavigation`, `useSlot`, `useSettingsCatalog`,
      `useNotifications`, `useCurrentPage`) and compound `AppShell.*` components with a
      `components` override map.
- [ ] Declared `slots` (Shell and `bitakit.config.ts`) generate `SlotMap`. `doctor` warns when
      a view targets a slot no layout renders.
- [ ] Layouts discovered from `src/layouts/<name>.tsx`; pages choose with
      `export const layout = 'admin'`; `blank` renders nothing around the page.
- [ ] Shell options via a schema in `configs/shell.ts`; features derive from contributions
      instead of booleans (`appearance`, `pluginManagement`). Notifications are a service.
- [ ] Theme: generated token file `src/app/theme.css`; appearance settings (`mode`, `preset`,
      `density`) owned by Shell; presets declared in a package manifest as CSS.
- [ ] Package manifests declare plugin `dependencies`; discovery activates transitive plugin
      packages.

Removes

- [ ] `SettingsSection`, `defineSettingsSection`, the `settings` / `settings.sections` /
      `settings.renderers` kinds, `theme.set` and `locale.set` as a second write path, the
      hand-written settings link in the demo plugin, the 84 lines of option plumbing in the
      Shell factory.

Done when

- A custom layout written only with the hooks renders every plugin contribution, and
  `apps/web` no longer contains a settings catalog.

## Phase 5: Adapters, packages and tooling (M)

Changes

- [ ] Adapter kit: `defineFramework({ router, routes })`. Next and TanStack rebuilt on it.
      Route emission for Next first; the client catch-all stays as fallback.
- [ ] Router contract: `navigate`, `pathname`, `params`, `subscribe`, `Link`.
- [ ] Package plugins become zero-argument factories; host objects arrive through contracts
      (`requires`). Migrate shell, app-preferences, quick-search first, then better-auth,
      organizations, next-intl. `bitakit build` covers `ui/`.
- [ ] `create-app` and `bitakit init` write the new shape. `bitakit add` covers all kinds and
      nested paths. `doctor` gains wiring and graph checks and `--json`.
- [ ] Testing: typed `mountPlugin` (reads the generated maps, honours `plugin.config.ts`),
      `renderWithFoundation`, event recorder.
- [ ] Package hygiene: discovery moves to `@bitakit/discovery` so `typescript` and `jiti`
      leave Core's runtime dependencies; `@bitakit/ui` declares zustand; `@bitakit/next` peer
      range matches `@bitakit/ui`.

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
