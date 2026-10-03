---
name: foundation-development
description: Develop or review BitaKit packages, plugins, example apps and integrations in this repository against the agreed architecture, conventions and verification workflow.
---

# BitaKit development

Goal: a thin host app and self-contained plugins. Shared mechanisms belong in the packages.
This guide complements the rules in the nearest `AGENTS.md`. It applies to this repository,
not to applications in general. Historical review notes live in `REVIEW.md`; the target
API is specified in `docs/target-api.md`, the sequencing in `refactor-phases.md`.

## Read the task first

- Analysis, a future idea or "from next time on" does not mean rebuild now. Execute work that
  is already authorized; do not ask for the same consent twice.
- Distinguish changes, running checks and finished results. Report success only after an
  actual check. Skipped tests are not passed tests; name required credentials.
- Write all documentation, guidance and code comments in English, whatever the conversation
  language. Product translation catalogs stay localized data.

## Parity rules

These keep the later server side cheap and are enforced from Phase 1 on.

1. Every headless primitive takes one context object with the same keys everywhere:
   `({ services, config, events, store, ... })`. The server later adds a request `ctx`
   as a method argument, nothing else.
2. React only under `ui/`, Node only under `server/`. `server/` is reserved and never bundled.
3. Shared files are isomorphic by construction: `events.ts`, `settings.ts`, `config.ts`.
4. Services are the unit of logic on both sides. Actions exist only on the client.
   Interceptors have one shape.
5. One generator writes `src/bitakit.gen.tsx` now and `src/bitakit.server.gen.ts` later.
6. One error model: a startup error always names the plugin and the file.

One documented way per concept. A convention that does not fit on the generated AGENTS.md
page (`packages/create-app/src/project-files.mjs`) is too complicated.

## Plugin folder

```text
src/plugins/<id>/
├── services/<file>.ts     defineService   → services.<id>.<file>
├── actions/<file>.ts      defineAction    → <id>.<file>
├── events.ts              defineEvents    → <id>.<name>
├── settings.ts            defineSettings  → settings.<id>.<name>
├── configs/<file>.ts      defineConfig    → app.config.<id>.<file>
├── interceptors/<file>.ts defineInterceptor
├── setup.ts               optional; `({ app, services }) => cleanup?`
├── plugin.config.ts       optional; dependencies, metadata, id, entries
├── locales/<lang>.json    { "<id>": { ... } }
└── ui/                    React only
    ├── pages/<path>.tsx   /<id>/<path>; [param] segments; `export const layout`
    ├── slots/<slot>.tsx   component in slot "<slot>"; `export const order`
    ├── dialogs/<name>.tsx components an action opens with `dialog`
    ├── settings/page.tsx  replaces the generated settings page of the plugin
    └── providers/<name>.tsx React provider; `export const requires`
src/layouts/<name>.tsx     app layouts; pages opt in with `export const layout = '<name>'`
```

- The folder name is the plugin ID. Folders only: `actions.x.ts` and `x.action.ts` are
  legacy spellings that discovery warns about and `bitakit migrate` rewrites. Do not add
  them to templates, docs or apps.
- Files need a default export; discovery parses, never executes, and warns about skipped
  files. Prefix helpers with `-`. `.d.ts` and `server/` are skipped.
- The app module uses the same folders directly under `src/` with the ID `app` and
  unprefixed IDs. App-owned routes stay native framework routes; plugin pages render
  through the generated catch-all with `<PluginPage />`.
- `bitakit.config.ts` (`defineBitaKit` from `@bitakit/core/discovery`) holds host overrides:
  `configOverrides`, `actions.overrides`, `plugins.overrides/include/autoEnable`, `packages`,
  `interceptors.enabled`, `slots`, `strict`, `kinds`. Integration kinds live under
  `contributions/<folder>/` of each module; `settings/`, `providers/` and similar names are
  not reserved at the app root.
- Generated output is `src/bitakit.gen.tsx` (`createBitaKitConfig`, `BitaKitProvider`, type
  augmentations), `src/bitakit.gen.css` and `src/bitakit.gen.messages.json`, ignored by Git.
  Nothing is aliased, so Turbopack and Webpack behave the same; no `--webpack` flags.
- Plugin packages use the same folders under `src/`, declare `bitakit: { plugin: './plugin' }`
  and build with `bitakit build` (`dist/plugin.js`). A plugin moves between
  `src/plugins/<id>` and a package unchanged. Zero-argument factories; host objects arrive
  through contracts (Phase 5).

## The define helpers

```ts
defineService(({ services, config, events, store, onStart, onStop }) => instance, { requires, provides, exposeAs });
defineAction({ title, enabled, visible, icon, href, input, execute, dialog, confirm, concurrency, success, failure, groups, shortcut, ... });
defineEvents({ changed: event<Payload>(), deleting: event<P>({ cancelable: true }) });
defineSettings({ pageSize: setting({ default: 20, schema?, scope?, label?, control?, options? }) }, { title, category, order, path });
defineInterceptor({ action: 'todos.*', before, after, onError, order, scope }) | defineInterceptor({ service, method, before, after, onError });
defineConfig({ schema?, defaults? });
definePlugin({ id, dependencies, services: { name }, actions: { name }, events, config, interceptors, setup, ui: { pages, slots, providers } });
```

- **Services** own behavior and state. `store(initial)` returns `{ get, set, subscribe,
  optimistic }`; anything with `subscribe(listener)` is observed by the runtime, which
  re-evaluates function-valued action fields and feeds `useServiceState`. Services never
  notify by hand. `requires` is an optional startup check that also orders creation; a
  missing service fails with a named error either way. `provides` registers a contract
  alias (`defineContract<T>('auth')`), and the instance must satisfy the contract; a key
  created as `serviceKey<T, 'notifications'>('notifications')` carries its literal name and
  types `services.notifications` in every host. `exposeAs` is deliberate flattening only.
  Async work goes in `onStart` (awaited before `ready`), cleanup in `onStop`.
- **Actions** have one shape. Presentation fields (`title`, `description`, `tooltip`, `icon`,
  `variant`, `href`, `enabled`, `visible`, `checked`, `value`) take a value or a function of
  `{ input, services, config, settings, app }`, evaluated per binding input and on store or
  setting changes. `input` schemas (zod, valibot, Standard Schema) type, validate and
  disable while invalid. `execute({ input, services, config, settings, app, events, signal,
  id, get, update })` is sync or async; pending is set only when a promise is returned.
  `href` is navigation, `dialog` opens a component (`{ input, close, services }`), never both
  with `execute`; `dialog: { component, kind, size }` names a host frame, and hosts register
  frames through `FoundationProvider` `dialogs` to decide the appearance. `confirm`
  routes through the host confirmation; `concurrency` is `exclusive` | `per-input` |
  `latest`. Removed and not to be reintroduced: `resolve`, `watch`, `events`/`onEvent`,
  `setup`, `initialState`, `state`, `dependsOn`, `conventions`, `configPath`,
  `unavailable`, `replaces`, the curried builder, class/factory discovery,
  `defineURLAction`, `defineDialogAction`, `defineFormAction`. Action state lives in a
  service store.
- **Events** are declared once per plugin in `events.ts`; names are `<plugin>.<name>`, only
  the declaring plugin emits them, `on` accepts names, arrays and `prefix.*`. Cancelable
  events make `emit` return `Promise<boolean>`. Delivery is synchronous; errors go to
  `onEventError`. Use a store for state inside a plugin and an event to notify other plugins.
- **Config** is immutable developer input, one file per subtree under `configs/`
  (`configs/actions/<action>.ts` is that action's scope), overridden in `bitakit.config.ts`.
  `config.plugin.get(path, fallback)`, `config.action.get(...)`, `app.config.<plugin>...`.
- **Settings** are user, organization or device values declared once per plugin in
  `settings.ts`; keys are `<plugin>.<name>` (plain names for the app). Every context reads
  and writes them through `settings.<plugin>.<name>.get()/set()/subscribe()`, React through
  `useSetting(key)`. The runtime owns the values (`runtime.settings`), follows the `auth`
  contract for the identity, re-evaluates presentation on changes and persists through the
  `settings.storage` contract (browser storage by default; a server storage is one service
  with `provides: settingsStorage`). Generated pages render every plugin's settings under
  `/settings/<plugin>`; `ui/settings/page.tsx` replaces a plugin's page. Never keep a second
  value store, section registry or renderer registry.
- **Interceptors** target `action` or `service`, never both in one definition. Plugin
  interceptors are plugin-local unless `scope: 'global'`; app interceptors are global
  unless `scope: 'plugin'`. `before` returning `false` cancels; service hooks only observe.
- **Feedback** defaults: silent success, one failure toast, `<id>.success`/`<id>.failure`
  catalog keys when present, `success: false` silences. The runtime owns the one failure
  observer; hosts must not toast the same `ActionFailure` again from `onError`.
- **Translation**: `title`/`description`/`tooltip` resolve as key, then `<id>.title` etc.,
  then literal. Never translate action labels separately in buttons, menus or search.

## React bindings (`@bitakit/ui`)

- `useAction(id, input)` returns state plus `props()`, `linkProps()`, `checkedProps()`,
  `valueProps()`, `menuItemProps()`; `<Action id input kind>` merges them into one child
  (empty child → icon + title; render-prop form for full control); `ActionButton` and
  `ActionLink` are sugar on `<Action>`. `useActionGroup(s)` for menus and navigation;
  `ActionMenu`, `ActionBoundary`, `PluginSlot`, `PluginPage` (passes `params`).
- `useServiceState(name, selector?, fallback?)` is the one way to read service state;
  `useService(name)` the instance; `useEvent(name, handler)` the bus; `app.has(name)` for
  availability; `useSetting(key)` one setting; `useSettingsCatalog()` the sections of a
  settings UI; `useNavigation(groups)` and `useSlot(name)` the data layouts render;
  `useCurrentPage()` the page and its `layout` name. Readiness is handled inside the hooks.
- One `FoundationProvider` with `config`, `additionalPlugins` (merge by ID, replace only
  when explicit), `controls` (prop-name adapters), `notify`, `services`, `isolateFailures`.
  The generated `BitaKitProvider` passes the discovered config; the framework adapters add
  navigation and query state. Pending is passed as a prop, never a swapped label.
- Removed: `ActionBinding`, `ActionCheckbox`, `ActionRadioGroup`, `ActionMenuItem`,
  `ActionGroupBinding`, `ActionMenuView`, `useRegisterAction(s)`, `app.optional.services`.
  Deprecated aliases: `useWatchEvent` (`useEvent`), `useFoundationReady`.
- Renderers read live snapshots and groups through the bindings; no copied action state,
  no hard-coded lists of action IDs where a group binding fits, no second ActionList.

## Startup, errors and isolation

- `createRuntime(config, { actions, services })`; `runtime.mount()` returns `stop`;
  `runtime.ready` resolves after every `onStart`. Every startup failure is a
  `FoundationStartupError` with `plugin`, `app`, `source` and the offending identifier in
  the message (duplicate IDs, cycles, missing services with suggestions, duplicate pages,
  invalid hrefs, failed start). Do not throw bare errors from startup paths.
- In development `FoundationProvider` turns off the failed plugin and its dependents, shows
  the startup report and explains a required service of a turned-off plugin on the page.
  Production fails fast; `isolateFailures` changes the default. Never swallow unrelated
  errors.
- Setup is synchronous; `setup` and service `create` do not receive the `app` facade before
  mount. `PluginScope` (`app.actions.getGroup(id).attach/add`, `app.own`) tracks cleanup.

## Package boundaries

- `@bitakit/core` is headless: no React, no router, no vendor imports; presentation values
  are opaque. `@bitakit/ui` holds generic bindings and the optional `./components` entry
  with standard shadcn/Radix Vega primitives that inherit host theme tokens; no Shell,
  Settings or app behavior there. Framework routing and nuqs adapters live only in
  `@bitakit/next` and `@bitakit/tanstack`. Core discovery is Node-only.
- Optional packages are ordinary plugins (Better Auth, next-intl, organizations, email,
  nodemailer, Shell, App Preferences, Quick Search, devtools). No second integration
  lifecycle, registry, provider bootstrap, session store or preference store. Contracts via
  `defineContract`/`provides`/`requires`; optional services are not declared as installed by
  global types alone.
- Settings: Core's `SettingsStore` is the only owner of confirmed values; sections derive
  from `defineSettings` declarations and `ui/settings/page.tsx`; `@bitakit/app-preferences`
  renders them and projects them into URL actions; nothing else registers sections or
  renderers. A server storage re-reads the isomorphic `settings.ts` files it trusts; client
  declarations grant no persistence access. Shell owns the app frame (compound `AppShell`,
  hooks, layouts, slots), its appearance settings and the HeroUI notification surface
  (`app.services.notifications`).
- Better Auth, Better Auth UI and other upstream libraries are used unmodified through
  public exports and configuration: no vendored copies, patches, private imports or fragile
  DOM selectors. Server authorization, sessions and roles stay with the provider; browser UI
  activation never configures the server. Credentials stay in ignored env files.
- Package hygiene: each package's README keeps a source responsibility map; public entries
  are small; styles ship with the owning package (`styles.css` export, `sideEffects`),
  imported once through `bitakit.gen.css`; `packages/README.md` stays the newcomer's map.

## UI rules

- Always use the central components and theme tokens (`@bitakit/ui/theme.css`, Radix Vega
  sizes, Reicon Outline). No local border/radius/shadow/color overrides, no quickly styled
  replacement buttons, dialogs, sidebars, badges or tables. Name a gap instead of inventing
  a visual special case; authorized changes go to the central component.
- Status is conveyed by text and accessible icons, never by color alone. Loading, empty,
  error and pending states belong to the affected surface.
- Confirm consequential actions with `confirm` (target and consequence named, cancel
  without mutation, protection against double execution, re-check context after the
  answer); no blanket dialogs for harmless actions. Server authorization remains binding.
- Responsive behavior is mandatory for every new or changed surface: narrow, medium and
  wide viewports, long unbroken content, missing images, no horizontal page overflow; table
  scrolling stays inside the table container; one table implementation for all sizes.
- Dialogs use the shared `DialogHost` and semantic sizes (`dialogSize: 'wide'`); measure
  rendered widths, do not only read CSS classes. Boolean `data-*` flags are set as
  `value || undefined`. `Field` stays a direct child of `FieldLabel`.
- Explicitly local demos must not present login, invitations or tokens as real, and add no
  database access.

## Verification workflow

- Dev loop for discovery, groups or lifecycle changes, checked in a running app, not only a
  build: a new action file in a rendered group appears without restart; a changed title and
  a removed file update without duplicates; a new group is visible only where the host
  renders it; a navigation action opens a real page as a native link; disabling a plugin
  removes every contribution and cleanup runs; language, form state and organization
  switches survive where affected.
- Headless tests: `mountPlugin(directory, { id, plugins, services, configOverrides })` from
  `@bitakit/core/testing` discovers one plugin folder like an app, awaits `ready`, records
  events and releases everything on failure. Keep services, actions, events, configs and
  `setup.ts` free of JSX and guarded against browser-only APIs.
- Chain: `npm test` (every package), `npm run check` (web typecheck and lint),
  `npm run verify:generated` (packed packages, every generated shape, install, types, build,
  browser smoke), `bitakit doctor` in generated apps, `npm run build:docs` for the docs site.
  Run the checks relevant to the change; do not rerun green suites without new changes.
- UI consistency is an acceptance criterion: central components and tokens, keyboard
  operation, narrow viewports, light and dark, computed styles in a browser. A successful
  build is not a visual check; package or DOM tests are not a full-host check.
- Tests must still cover the real user path after a UI rebuild. Browser tests use isolated
  Better Auth memory data, never shared accounts; keep test keys out of logs and screenshots.
- Doctor is the place for wiring checks; add a check when a confirmed integration mistake
  can be detected mechanically.

## Deprecation policy

- Deprecated helpers map onto the current API, warn once in development through `deprecated()`
  in `packages/core/src/compat.ts` and are removed in Phase 5 after the optional packages are
  migrated: `provideService`, `defineURLAction`, `defineDialogAction`, `definePage`,
  `defineView`, `defineSetup`, `defineServiceInterceptor`, the object form of
  `defineService`, action `resolve`/`watch`, `publicServices`, `foundation.config.ts`,
  `foundation-generate`, `withFoundation`, `@bitakit/next/generated`, `useWatchEvent`.
- Do not add new code against deprecated helpers, and do not document them as options.
  `bitakit migrate` is the codemod; run it on the repo apps when the layout changes.
- When an API changes, update in the same step: Core tests, the CLI templates
  (`packages/cli/src/templates.mjs`, the single source for `--sample`, `bitakit add` and
  plugin packages), the generated AGENTS.md, this skill, `docs/target-api.md` if the contract
  moved, the package READMEs, the docs site and `docs/TODO.md`.

## Maintenance

- Keep this skill a maintained guide, not a copy of the code: durable rules and invariants
  only. Record a new confirmed mistake as a rule or a check scenario here, and move resolved
  review episodes to `REVIEW.md` ("History") as one line each.
- Before finishing, check code, skill and affected guides for contradictions. Mark roadmap
  items done only after implementation and verification. If a phase makes the generated
  AGENTS.md longer, the phase added complexity.
