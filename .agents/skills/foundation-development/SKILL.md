---
name: foundation-development
description: Develop or review BitaKit packages, plugins, example apps and integrations in this repository against the agreed architecture, conventions and verification workflow.
---

# BitaKit development

Goal: a thin host app and self-contained plugins. Shared mechanisms belong in the packages.
This guide complements the rules in the nearest `AGENTS.md`. It applies to this repository,
not to applications in general. Historical review notes live in `.private/bitakit-enhancement/review-history.md`,
the target API in `.private/bitakit-enhancement/target-api.md` and the sequencing in `.private/bitakit-enhancement/TODO.md`.
These planning files are local-only and may be absent in another checkout.

Private analyses, proposals, working TODOs and review notes belong under `.private/`, which
is ignored by Git. Resume an existing task from its proposal and TODO rather than recreating
its plan. These working documents do not change the implemented API conventions below.
External comparison studies and superseded input proposals belong in a private archive outside
the checkout. Keep active BitaKit plans and verification here; preserve recoverable originals
when removing historical research from the project.

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

Most plugins are two or three files. Docs, templates and generated samples start with the
fewest files that work (a page, or a service and an action) and add a folder only when a
feature needs it; never scaffold every kind. The complete layout, every entry optional:

```text
src/plugins/<id>/
├── services/<file>.ts     defineService   → services.<id>.<file>
├── actions/<file>.ts      defineAction    → <id>.<file>
├── events.ts              defineEvents    → <id>.<name>
├── settings.ts            defineSettings  → settings.<id>.<name>
├── configs/<file>.ts      defineConfig    → app.config.<id>.<file>
├── slots/<file>.ts        defineSlot      → <id>.<file> (owned contract)
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
- `bitakit.config.ts` (`defineBitaKit` from `@bitakit/discovery`) holds host overrides:
  `configOverrides`, `actions.overrides`, `plugins.overrides/include/autoEnable`, `packages`,
  `interceptors.enabled`, `slots`, `strict`, `kinds`, `catalog`. Integration kinds live under
  `contributions/<folder>/` of each module; `settings/`, `providers/` and similar names are
  not reserved at the app root.
- Generated output is `src/bitakit.gen.tsx` (component-only `BitaKitProvider`) and `src/bitakit.gen.config.ts` (`createBitaKitConfig`, type augmentations), `src/bitakit.gen.css` and `src/bitakit.gen.messages.json`, ignored by Git.
  Nothing is aliased, so Turbopack and Webpack behave the same; no `--webpack` flags.
- Plugin packages use the same folders under `src/`, declare `bitakit: { plugin: './plugin' }`
  and build with `bitakit build` (`dist/plugin.js`). A plugin moves between
  `src/plugins/<id>` and a package unchanged. Zero-argument factories; host objects arrive
  through contracts (Phase 5).

## The define helpers

```ts
defineService(({ services, config, events, store, onStart, onStop }) => instance, { requires, provides, exposeAs });
defineAction({ title, enabled, visible, icon, href, input, execute, dialog, confirm, concurrency, success, failure, groups, slots, shortcut, ... });
defineEvents({ changed: event<Payload>(), deleting: event<P>({ cancelable: true }) });
defineSettings({ pageSize: setting({ default: 20, schema?, scope?, label?, control?, options? }) }, { title, category, order, path });
defineInterceptor({ action: 'todos.*', before, after, onError, order, scope }) | defineInterceptor({ service, method, before, after, onError });
defineConfig({ schema?, defaults? });
defineSlot({ accepts: 'actions' | 'component' | 'data', policy: 'list' | 'single' | 'keyed', payload?, schema? });
definePlugin({ id, dependencies, services: { name }, actions: { name }, events, config, slots: { name }, interceptors, setup, ui: { pages, slots, providers } });
```

- **Services** own behavior and state. `store(initial)` returns `{ get, set, subscribe,
  optimistic }`; anything with `subscribe(listener)` is observed by the runtime, which
  re-evaluates function-valued action fields and feeds `useServiceState`. Services never
  notify by hand. `requires` is an optional startup check that also orders creation; a
  missing service fails with a named error either way. `provides` registers a contract
  alias (`defineContract('auth').of<AuthService>()`, the one documented form; the name is
  written once and stays literal), and the instance must satisfy the contract; the literal name
  types `services.<name>` in every host that installs the provider. Core code reads contracts
  through `getService(services, key)`; `ServiceMap` has no hand-written `auth`/`i18n` entries.
  `serviceKey<T, 'name'>('name')` remains the low-level form. A contract name must not sit under an existing
  service name (`auth.client` fails while `auth` is a service; use `better-auth-client`).
  Host objects reach package plugins as services (`provides`), never as factory arguments; a
  Proxy client whose `subscribe` is not an observable must be wrapped (`{ client }`) because
  the runtime observes everything with `subscribe`. Services exist only after mount, so a UI
  provider keeps its tree shape until the runtime is ready. `exposeAs` is deliberate
  flattening only. Async work goes in `onStart` (awaited before `ready`), cleanup in `onStop` (reverse order, awaited). Await `stop()` before replacement; repeated
  calls share completion. Cleanup failures aggregate after other disposers run and block
  remount. A hook or Action must not await its enclosing runtime's stop. Late `onStop`
  registration during awaited startup is allowed until disposal; closed scopes reject `own`.
  Optional service reads use `app.has(name)` (or `name in services` in a factory); missing
  reads always throw, including `auth`/`i18n`. `requires` remains consumer-owned.
- **Actions** have one shape. Presentation fields (`title`, `description`, `tooltip`, `icon`,
  `variant`, `href`, `enabled`, `visible`, `checked`, `value`) take a value or a function of
  `{ input, services, config, settings, app }`, evaluated per binding input and on store or
  setting changes. Presentation and `confirm` `input` is typed `Input | undefined`: unbound
  snapshots, group items and unmapped slot placements evaluate without input, and they see the
  raw value before validation; only `execute` gets the parsed input. Call-site input stays
  optional: toggle/choice bindings, forms and controls supply it at execution. `input` schemas (zod, valibot, Standard Schema) type, validate and
  disable while invalid. `execute({ input, services, config, settings, app, events, signal,
  id, get, update })` is sync or async; pending is set only when a promise is returned.
  `href` is navigation, `dialog` opens a component (`{ input, close, services }`), never both
  with `execute`; `dialog: { component, kind, size }` names a host frame, and hosts register
  frames through `FoundationProvider` `dialogs` to decide the appearance. Built in without a
  registered frame: `dialog` (visible header) and `command` (shadcn's CommandDialog: no visible
  header or close button, the content's search field leads, the title stays for assistive
  technology). `confirm`
  routes through the host confirmation; `concurrency` is `exclusive` | `per-input` |
  `latest`. Removed and not to be reintroduced: `resolve`, `watch`, `events`/`onEvent`,
  `setup`, `initialState`, `state`, `dependsOn`, `conventions`, `configPath`,
  `unavailable`, `replaces`, the curried builder, class/factory discovery,
  `defineURLAction`, `defineDialogAction`, `defineFormAction`. Action state lives in a
  service store.
- Slot/group renderers pass the resolved control to `Action` or `useAction`; mapped input
  stays on that control. Bindings accept dynamic controls even when every generated Action
  returns `void`. Keep strict checks on literal IDs and known inputs. The independent
  `packages/ui/tests/strict-action-types.tsx` checks the built declarations in that host mode.
- One `strict` switch (`ActionMapOptions { strict: true }`, generated by default) narrows every
  generated name through `GeneratedName<Known>`: Action IDs, events (`on`/`useEvent` also take
  `<plugin>.*` patterns and `*`), slots, settings and React service names. Never add a second
  option or a runtime name registry. Host generation types installed packages through
  `Public{Services,Settings,Slots,Actions,Events,Cancelable}Of`; record-form package Actions are
  typed, explicit-ID arrays are not.
- **Events** are declared once per plugin in `events.ts`; names are `<plugin>.<name>`, only
  the declaring plugin emits them, `on` accepts names, arrays and `prefix.*`. Cancelable
  events make `emit` return `Promise<boolean>`. Delivery is synchronous; errors go to
  `onEventError`. Use a store for state inside a plugin and an event to notify other plugins.
- **Config** is immutable developer input, one file per subtree under `configs/`
  (`configs/actions/<action>.ts` is that action's scope), overridden in `bitakit.config.ts`.
  `config.plugin.get(path, fallback)`, `config.action.get(...)`, `app.config.<plugin>...`.
  Values must be plain serializable data. Native plugin objects, callbacks and QueryClient
  instances belong in the existing optional adapter's client composition, passed to the
  generated provider as additional plugins; never loosen Core's config contract for them.
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
  unless `scope: 'plugin'`. Action `before` returning `false` skips with `intercepted`;
  async gates are awaited. `after`/`onError` only observe; their returns do not replace
  outcomes. Matching Action hooks share one ordered sequence, not plugin-then-global stages.
  Action hooks receive ActionContext plus `services`, `config`, `app`, `translate`, not
  the handler's direct `settings`/`events` fields. Service hooks only observe and are not
  awaited; preserve the original method's return value, promise and error.
- **Feedback** defaults: silent success, one failure toast, `<id>.success`/`<id>.failure`
  catalog keys when present, `success: false` silences. The runtime owns the one failure
  observer; hosts must not toast the same `ActionFailure` again from `onError`.
- **Translation**: `title`/`description`/`tooltip` resolve as key, then `<id>.title` etc.,
  then literal. Never translate action labels separately in buttons, menus or search.

## Slot declarations

- `defineSlot` is a headless declaration. `Plugin.slots` owns contracts; `ui.slots` contributes
  components. `slots/header.actions.ts`, `slots/header/actions.ts`, index collections and
  manual dotted/nested records normalize identically. App-root names are unprefixed even
  with a custom app ID; plugin names are qualified. Explicit IDs are absolute; arrays need IDs.
- `accepts` is `actions`, `component` or `data` (requires `schema`). `payload` describes owner
  context. Use existing zod/Standard Schema support, `SlotPayload` and `SlotData`; do not add
  validators or React types to Core. `policy` defaults to `list`; `single`/`keyed` promise
  conflict errors, never implicit replacement. Pending attachments reserve their IDs/keys too.
- `SlotMap` contains contracts, `LegacySlotMap` contains old manifest/config name hints only.
  Hints never override typed declarations or activate owners. `runtime.modules[].slots` is
  immutable declared inventory, not readiness or proof of a mounted renderer.
- `bitakit add slot-definition` writes `slots/`; `bitakit add slot` still writes `ui/slots/`.
  `bitakit build` generates types and `dist/plugin.slots.json` static hints from source.
  Never maintain the sidecar by hand. Doctor never executes contributions; computed/imported
  collections are reported as unresolved, not guessed. Runtime duplicate checks are authoritative.
- Action `slots: ['shell.navigation']` or `[{ name, input: ({ payload }) => ..., order?, key?, availability? }]`
  adds owned references to the single Action registration (default wait). Groups are logical
  queries, not implicit placement. Unknown targets fail; internal Actions never enter slots.
  Optional integrations can explicitly test `app.slots.has(name)` before attaching.
  App Preferences projects catalog pages into these slots; compatible host updates rebuild its projection.

- Use runtime-issued `app.slots.attach(name, { component | data | actionId, id?, key?, order? },
  { availability: 'require' | 'wait' })`. Default require checks owner readiness; wait accepts
  known definitions only. Both follow subsequent availability. Contributor close immediately
  revokes entries and waiters before awaited cleanup. Never attach by emitting status events.
- `runtime.slots.get/subscribe/watch` retain current immutable snapshots; watch subscribes
  before its initial callback. Reentrant observers invalidate the active refresh before it
  resolves readiness or processes further entries. Scoped observers stop with the contributor. Handles
  expose get/subscribe/watch/ready/dispose; ready is first attachment only. Use the existing
  runtime-owned `runtime.slot` event for notifications, not as a second state store.
- `ui.slots` targeting declared contracts use that same path (default wait); discovery preserves
  id/key/order/availability and source. Data validation uses existing async schemas once, with
  late results revoked on close. Action entries reference existing public Action IDs only.
- Outlet mount/unmount never owns an attachment. `useSlot(name, { payload })` returns
  `{ items, payload, pending, phase, error }`; entries are action/component/data discriminated by `kind`.
  Each outlet validates its own payload with the existing schema API and ignores stale async
  results. Keep nested payload objects stable with React memoization. Action mappers run per
  outlet; absent mapping means undefined input. Bind `item.action` with `Action`, preserving
  contextual input, live presentation and existing guards. `PluginSlot` renders component
  entries with the parsed payload. The initial readiness barrier remains; compatible updates
  gate affected owners only. `phase` reports declared-owner status; failed/blocked is not pending.
- `PluginSlot` isolates each component with `react-error-boundary`; custom `useSlot` renderers
  use `SlotErrorBoundary` inside access controls. Optional `errorFallback({ error, retry })`
  customizes recovery. `SlotRenderError` attributes slot/plugin/contribution; local reporting
  uses existing `actionOptions.onError`. Raw causes never enter default UI or Core inventory.
  Reset on explicit retry or changed raw owner/component, never global revision, normalized
  modules or unstable payload objects. Preserve healthy siblings and attachment ownership.
  Payload/binding errors, Suspense, server rendering and later async/handler failures retain
  their own mechanisms. App Preferences bodies name the actual page owner; access revocation
  removes all protected body/extension recovery UI.
- Render slot entries with `item.key`, not the Action ID. One Action can have multiple
  keyed placements in the same outlet with different mapped inputs; keep each placement's
  identity through navigation and menu adapters.
- Shell renders `shell.navigation`, `sidebar.header/footer` (payload `{ collapsed }`) and
  `app-bar.end`. Its `navigationSlot` option replaces `groups`. The organization member menu
  reads `organizations.member.menu` with `{ organizationId, memberId }`; group-only actions do
  not join that menu. Organization toolbars and invitation menus use explicit slots too.
  Existing slot contracts stay immutable; structural owner additions/removals use the plugin API below.
- Shell also renders the Action slot `shell.toolbar` before `shell.header.end` in both layouts.
  For a standard toolbar control, use `defineAction({ ..., slots: ['shell.toolbar'] })`; no
  widget file is required. Shell reuses `Action` and the standard Button, including native links,
  live presentation, mapped placement input and guards. Component header slots remain unchanged.
  In custom widgets, sugar bindings use `ActionButton action` / `ActionLink action`; only
  the generic `Action` component uses `id`.

## Lifecycle state and hosts

- `runtime.lifecycle.get()/subscribe()/watch()` expose immutable status, including current
  state for `watch`, per-plugin/service readiness and cleanup completion. `runtime.lifecycle`
  on the existing event bus is runtime-owned. Observers cannot veto execution or own state.
- `createRuntimeController(config, { failures: 'fail-fast' | 'isolate' })` owns startup policy
  for headless and React hosts. Isolation blocks dependency closure, awaits the old runtime
  and rebuilds the remaining composition. App failures/cleanup failures are fatal. This is
  not incremental replacement. Keep serial startup and existing service/Action ownership.
- React cleanup cannot await. Keep the previous completion barrier through skipped intermediate
  configurations and StrictMode; never start a replacement while resources are still stopping.
- `mountPlugin` exposes awaitable `stop()` and `Symbol.asyncDispose`; `renderWithFoundation`
  awaits teardown too. Event recordings include lifecycle events; filter by domain event
  when testing business behavior. Test helpers release partial startup before rejecting.

- Explicit host `runtime.reconcilePlugins(next)` updates immutable already-loaded definitions.
  Keep unchanged references. It preserves unrelated services, restarts the dependency closure
  and composition readers, drains affected Actions and awaits cleanup/start. Same plugin order,
  service identity/requirements and foundational declarations are required; provider/installer/
  interceptor or auth/i18n/storage owners require replacement. Honor all four result statuses;
  never await the update from affected owned work. Initial `ready` is not update completion.
  Failed clean startup allows explicit retry; failed cleanup blocks reuse. No automatic file HMR,
  runtime package installation, affected React local-state retention or rollback is implied.
- Host-only `runtime.plugins.add(definitions)`, `remove(ids, { dependents: 'stop' | 'refuse' })`,
  `disable(id, { dependents })` and `enable(id)` reuse that executor for structural membership.
  Preflight declarations, stop consumers before providers, drain Actions and await cleanup.
  `stop` disables dependents; re-enable providers then consumers explicitly. Removing owned slots
  includes active contributors. Disabled settings/event/slot declarations stay reserved; disabled
  values are retained. Removal releases declarations but never deletes stored settings. Pending
  setting writes block removal, including a recheck after awaited cleanup; a late write leaves
  affected owners blocked until explicit retry. Failed update cohorts preserve recovery of
  disposed composition-reader scopes. Late loads cannot overwrite reinstalled settings. Installed
  definitions live in config.plugins; active modules and lifecycle are the runtime truth.
  App/provider/layout/installer/interceptor/custom-kind/auth/i18n/storage owners remain restart-required.
  No optional captured-service rebinding or rollback. Compatible reconciliation requires every
  installed plugin enabled. Keep mutations outside affected Actions/hooks/disposers.
- Optional `@bitakit/packages` owns catalog loading and host selection orchestration, outside Core.
  `createPackageHost({ runtime, catalog }).reconcile({ scope, packages })` takes already-authorized
  active records, not client claims. No installation persistence/access policy is implemented.
  New selections supersede pending imports; changing scope releases old owned plugins first.
  Lifecycle overlap returns blocked and must be retried after settlement; do not queue behind
  an affected hook. Await a successful scope switch before revealing the new scope's UI.
  Catalog loaders return definitions without side effects. Native module caches/CSS are not
  unloadable; overlapping plugin IDs are rejected. One package version per host build.
  Discovery `catalog` generates literal lazy public-entry imports and static type-only imports
  in the config module, keeps CSS eager and excludes catalog entries from startup. Configured
  host packages remain eager. A new catalog/version needs a deployment. No remote code/sandbox.
- `isReady()`/`app.ready`/`useFoundationReady()` retain completed initial startup through targeted
  updates and become false on shutdown. Owner queries use `isReady(pluginId)` or
  `useFoundationReady(pluginId)`; service hooks and `app.has` check service plus owner readiness.
  Raw `hasService` is container presence for cleanup. Observe lifecycle for owner transitions.
  Unaffected pages/widgets/providers stay mounted; affected pages use `PluginPage.unavailable`
  when provided, and affected dialogs close. Verify draft/focus retention during slow stop/start,
  failure and retry; a final count assertion alone does not establish UI preservation.
  Gate the existing Action adapter before evaluating dynamic presentation for an unavailable
  owner; direct bindings must be safe even outside an owner-gated page or slot.
- `inspectRuntime` / `observeRuntimeInventory` (Core), `useRuntimeInventory` (UI) and CLI info
  share version 1: static declarations plus nullable live state. Preserve explicit unavailable
  fields and source attribution. Exclude config/settings values/defaults, stores, callbacks,
  components and raw errors. Public metadata is not a secret store. Interactive Devtools APIs
  remain separate. Runtime inventory covers current composition; controller isolation diagnostics
  retain excluded plugin failures. Do not invent installed-but-unmounted instances.

## React bindings (`@bitakit/ui`)

- Generated providers memoize discovered configuration rather than retaining the first
  composition in state. Verify Fast Refresh add/update/remove in a full host without manual
  reload; generation-only watcher checks are insufficient. Restart isolated test servers
  after changing Node-loaded generator code. Translate shared organization validation
  messages through the owning UI catalogs; never add a second validator to change wording.

- `useAction(id, input)` returns state plus `props()`, `linkProps()`, `checkedProps()`,
  `valueProps()`, `menuItemProps()`; `<Action id input kind>` merges them into one child
  (empty child → icon + title; render-prop form for full control); `ActionButton` and
  `ActionLink` are sugar on `<Action>`. `useActionGroup(s)` for logical queries; `useSlot` for placed menu/navigation Actions;
  `ActionMenu`, `ActionBoundary`, `PluginSlot`, `PluginPage` (passes `params`).
- `useServiceState(name, selector?, fallback?)` is the one way to read service state;
  `useService(name)` the instance; `useEvent(name, handler)` the bus; `app.has(name)` for
  availability; `useSetting(key)` one setting; `useSettingsCatalog()` the sections of a
  settings UI; `useNavigation(slotName)` and `useSlot(name, { payload })` the data layouts render;
  `useCurrentPage()` the page and its `layout` name. Readiness is handled inside the hooks.
- One `FoundationProvider` with `config`, `additionalPlugins` (merge by ID, replace only
  when explicit), `controls` (prop-name adapters), `notify`, `services`, `isolateFailures`.
  The generated `BitaKitProvider` passes the discovered config; the framework adapters add
  navigation and query state through `defineFramework({ id, useRouter, QueryState })`, whose
  router contract is `pathname`, `params`, `navigate(href, { replace })` and `Link`
  (`useFoundationNavigation()` reads it). Pending is passed as a prop, never a swapped label.
- Removed: `ActionBinding`, `ActionCheckbox`, `ActionRadioGroup`, `ActionMenuItem`,
  `ActionGroupBinding`, `ActionMenuView`, `useRegisterAction(s)`, `app.optional.services`.
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
  Production startup fails fast; `isolateFailures` changes the default. Do not broaden that
  startup boundary to unrelated render errors; slot components use the explicit render boundary above.
- Setup is synchronous; `setup` and service `create` do not receive the `app` facade before
  mount. `PluginScope` (`app.actions.getGroup(id).attach/add`, `app.own`) tracks cleanup.

## Package boundaries

- `@bitakit/core` is headless: no React, no router, no vendor imports; presentation values
  are opaque. `@bitakit/ui` holds generic bindings and the optional `./components` entry
  with standard shadcn/Radix Vega primitives that inherit host theme tokens; no Shell,
  Settings or app behavior there. Framework routing and nuqs adapters live only in
  `@bitakit/next` and `@bitakit/tanstack`. Discovery is Node-only and lives in
  `@bitakit/discovery`, which carries `typescript` and `jiti` so Core does not;
  `@bitakit/core/discovery` is a one-release re-export (optional peer). Internal code imports
  `@bitakit/discovery` directly.
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
- Native session cards cannot parse an empty user agent. The standard Better Auth client
  preset normalizes absent/blank list-sessions UA display metadata through its public fetch
  hook, retaining every session/token and delegating caller hooks. Never filter/revoke
  sessions or rewrite stored authentication data to avoid a rendering crash. Check actual
  account/security cards after list-sessions resolves, not only the page's outer heading.
  Organization management tabs require canManage; incoming invitations require verified
  email. Preserve those guards and test both an owner and a normal member.
- Package hygiene: each package's README keeps a source responsibility map; public entries
  are small; styles ship with the owning package (`styles.css` export, `sideEffects`),
  imported once through `bitakit.gen.css`; `packages/README.md` stays the newcomer's map.
- Store README banners and screenshots under the repository-level `docs/assets/readme/`,
  outside published packages. The root README uses repository-relative paths for local
  checkouts; package READMEs use absolute public image URLs for npm installations.
  Publish the referenced repository assets before releasing a package that links to them.
  Remote README images require network access; they are not runtime dependencies. Keep
  package assets eligible for publication and inspect `npm pack --dry-run --json` when
  changing published contents.

## UI rules

- Developer themes are defined once in the host root stylesheet after `bitakit.gen.css`;
  all supported visual packages consume the contract in `packages/ui/THEME.md`. Preserve
  runtime typography variables, semantic colors/radii, border/focus widths and optional
  `--theme-*` shadow/interaction/motion overrides. Keep numeric layout dimensions internal.
  Adapter mappings consume those tokens rather than resetting them inside each control.
  Root inheritance must reach portals and lazy components; reduced-motion preference wins.
  Verify both the default appearance and one distinct developer theme in a packed consumer
  across UI, Shell/toasts, App Preferences, Quick Search, native auth and Devtools.
- Always use the central components and theme tokens (`@bitakit/ui/theme.css`, Radix Vega
  sizes, Reicon Outline). No local border/radius/shadow/color overrides, no quickly styled
  replacement buttons, dialogs, sidebars, badges or tables. Name a gap instead of inventing
  a visual special case; authorized changes go to the central component.
- Match state/orientation selectors to the actual primitive library: Radix uses
  `data-state` and `data-orientation`, while Base UI uses presence attributes in relevant
  components. Do not copy Base UI selectors onto Radix or rewrite custom Sidebar active
  attributes. Forward orientation to Radix itself, and verify visible tab stacking, active
  indication and mobile overflow rather than only accessible headings.
- Verify CSS layer order in the served output, not only the root source: a package CSS
  side effect can register `components` before `base` and let the reset override controls.
  Use Discovery's package stylesheet metadata and one root integration path. Do not mask
  a cascade defect with per-component imports or local overrides. For loading changes,
  check native menu padding, input layout and button contrast in development and production.
- Check installed/packed plugin discovery: its manifest must be accessible through the
  package export used by Discovery, and styles/theme metadata must actually be collected.
  A host's manual plugin composition can hide a skipped installed package.
- Out-of-the-box styling acceptance uses a clean generated app with packed packages,
  including optional visual plugins, in development and production. Extend the existing
  generated-app verification workflow with rendered checks; a source import, successful
  doctor result or text-only browser smoke check does not establish cascade correctness.
- CSS loading safeguards must cover future plugins: establish the layer prelude before
  plugin CSS and validate the emitted import graph against baseline/theme ownership.
  Include negative plugin fixtures and lazy-load checks. Scope guarantees to the supported
  integration; unrestricted global CSS is not isolated merely by using cascade layers.
  Installed visual packages export `./package.json` and declare `bitakit.styles` separately
  from intentional `bitakit.theme` contributions. Discovery follows local CSS imports and
  explicit/wildcard emitted JS exports and literal relative/vendor imports, including
  extensionless CSS aliases. Computed runtime imports and unresolved required entries fail
  with named diagnostics. Missing optional peers are unavailable until installed and then
  audited. Vendor CSS can only import targets validated in the eager root graph; plugin-owned
  JS CSS imports remain rejected. Do not claim isolation from runtime style injection.
  Invalid watched CSS must
  invalidate the generated entry and recover after correction, never silently retain stale CSS.
- For settings identity changes, test a new identity's queued save while the previous
  identity's save is unresolved; every queued write must settle without crossing identities.
  Generic service subscriptions must preserve method receivers, including class services.
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
- Headless tests: `mountPlugin(directory, { id?, plugins, services, configOverrides })` from
  `@bitakit/core/testing` discovers one plugin folder like an app (the ID comes from
  `plugin.config.ts` or the folder), awaits `ready`, records events, types `execute` by action
  ID and releases everything on failure. React tests use `renderWithFoundation(element, { plugins, services })`
  from `@bitakit/ui/testing` (jsdom supplied by the test, events recorded). Keep services,
  actions, events, configs and `setup.ts` free of JSX and guarded against browser-only APIs.
- Chain: `npm test` (every package), `npm run check` (web typecheck and lint),
  `npm run verify:generated` (packed packages, every generated shape, install, types, build,
  browser smoke), `bitakit doctor` in generated apps, `npm run build:docs` for the docs site.
  Run the checks relevant to the change; do not rerun green suites without new changes.
- UI consistency is an acceptance criterion: central components and tokens, keyboard
  operation, narrow viewports, light and dark, computed styles in a browser. A successful
  build is not a visual check; package or DOM tests are not a full-host check.
- Tests must still cover the real user path after a UI rebuild. Browser tests use isolated
  Better Auth memory data, never shared accounts; keep test keys out of logs and screenshots.
  Keep public auth forms mounted during native session revalidation on browser focus.
  Put protected pending screens after public-route handling. Test Tab, visibility refresh,
  native account switching and organization changes without replacing upstream session state.
- Doctor is the place for wiring checks (missing providers for `requires`, plugin dependency
  cycles, undeclared slots, unreachable pages); add a check when a confirmed integration
  mistake can be detected mechanically. `bitakit init` wires an existing Next or TanStack app.
  Follow rendered local provider wrappers and real root CSS imports, not matching source
  strings or unused imports. Doctor establishes static wiring, not computed visual correctness.

- Distinguish awaited in-process runtime replacement from framework Fast Refresh. The supported
  Next add/edit/delete paths are verified after the watcher/provider corrections described in
  Development refresh below. Structural provider changes and changes outside a React refresh
  boundary can still reload. Runtime replacement and file-discovery refresh need separate evidence.

## Deprecation policy

- There are no runtime shims. The 0.1 helpers (`provideService`, `defineURLAction`,
  `defineDialogAction`, `definePage`, `defineView`, `defineSetup`, `defineServiceInterceptor`,
  the object form of `defineService`, action `resolve`/`watch`, `publicServices`,
  `appExtensions`, top-level `pages`/`views`/`providers`, `events.watch`, `useWatchEvent`,
  `withFoundation`, `@bitakit/next/generated`, `createFoundationConfig`,
  `foundation.config.ts`) were removed in Phase 5. Do not reintroduce them; `bitakit migrate`
  is the codemod and `bitakit doctor` names the old spellings.
- When an API changes, update in the same step: Core tests, the CLI templates
  (`packages/cli/src/templates.mjs`, the single source for `--sample`, `bitakit add` and
  plugin packages), the generated AGENTS.md, this skill, the private target API
  (`.private/bitakit-enhancement/target-api.md`) if the contract moved, the package READMEs, the docs site and the
  private TODO.

## Maintenance

- Keep source identifiers and comments in English. Document public APIs and important
  non-obvious functions with their purpose, ownership/lifecycle and failure constraints.
  Remove stale comments and unused material after checking references; keep required
  migrations and compatibility contracts. Update guidance with the implementation.
- Keep this skill a maintained guide, not a copy of the code: durable rules and invariants
  only. Record a new confirmed mistake as a rule or a check scenario here, and move resolved
  review episodes to `.private/bitakit-enhancement/review-history.md` ("History") as one line each.
- Before finishing, check code, skill and affected guides for contradictions. Mark roadmap
  items done only after implementation and verification. If a phase makes the generated
  AGENTS.md longer, the phase added complexity.

### Composable multi-page settings

- App Preferences owns `app-preferences.navigation`, `navigation.footer`, `page.body`
  (keyed by existing catalog ID), `page.after` (list) and `page.toolbar` (Actions). Authors
  still declare settings/pages once; the adapter owns derived references, not a second
  settings catalog/value store. Source and host stop revoke projections; compatible host
  updates restart composition readers, so affected Settings projections may still remount.
  Keep that limit explicit; unchanged service identity does not prove a Settings draft survives.
- `useSlot`/`PluginSlot` accept `entryKey` for a keyed outlet. A slot file may export a typed
  `when: SlotPredicate<'slot'>`; it filters each outlet's parsed payload, not shared status.
  Use Action `visible` with mapped input or service/setting hooks for reactive widget behavior.
- Settings page `boundary` is an opaque component around the complete host-rendered page,
  including extensions/toolbar; extra pages inherit it or override it. Preserve custom
  `{ section, renderField }`, `showHeader`, and existing access UI. Do not render protected
  extension slots outside the owner's boundary or infer authorization from visibility.
- Disabled navigation keeps a plain anchor without `href`; only enabled links use the host
  router Link, which may require `href` (for example Next.js).
- `linkProps({ href })` adapts a contextual URL through existing safe-link/disabled/native
  navigation behavior. Settings uses it for route-base and query preservation. Do not bind
  a displayed query URL while dispatching navigation to a different URL.
- `bitakit build` includes `settings.ts`, custom/extra settings pages, page boundaries and
  slot predicates; derived SettingsMap types use the same file normalizers as app discovery.

- `ui.settings.component` remains the default page; `ui.settings.pages` adds named pages
  with standard section metadata and an opaque component. The discovered settings page can
  export the same object. Never create fake plugins or host registries just to add pages.
- The pure catalog in UI is shared by `useSettingsCatalog` and App Preferences action
  projection. Keep stable page IDs separate from owning plugin metadata; fields remain on
  the default section and values remain owned by Core.
- The host owns the single page heading. Embedded organization content retains its toolbar,
  but omits its page heading. Wait for runtime readiness before reading organization services.
- Personal invitations belong under Account; organization profile and management have separate
  routes. Management content and server checks remain permission-bound on direct navigation.
- Destructive organization controls use a separate standard Card after the save form and a
  destructive Button, with accurate irreversible-action copy and the existing confirmation.

- Account Profile and Security are independent settings pages; native security cards remain
  grouped on Security. Export content independently for host composition. Organization
  appearance and general fields share one form/card and one end-aligned save control inside
  that card; destructive actions retain their own separate card. Use verified Reicon symbols
  appropriate to each page (envelope for personal invitations, shield for security).

- Settings card actions align at the logical end, per the user preference (right in LTR).
  Apply this in the shipped theme adapter and shared components, never app CSS. Target
  public action slots and direct form submit controls; leave password adornments untouched.

- Empty surfaces use the shared theme's `data-slot="empty"` components-layer default:
  dashed border, `--border-width`, and `--border`. Keep owning package primitives free of
  competing border-style utilities; normal host utilities may deliberately override it.

- Plugin details enumerate settings by owning plugin ID, including additional pages and the
  overview plugin itself. Use the shared PageHeader `before` slot for back navigation. A
  custom settings page owning its header declares `ui.settings.showHeader: false`. Long
  plugin lists scroll within a constrained viewport; header, breadcrumb and search stay fixed.

- Scroll regions containing standard cards need inner spacing for their outward rings and shadows; otherwise overflow clips the top and side borders. Verify the rendered edges, not only scroll geometry.


### Plugin catalog metadata

Plugin metadata may declare `tags: readonly string[]` and `coverImage`. Tags are optional,
case-sensitive catalog labels (prefer short stable lowercase names such as `security`),
not permissions or dependencies. The catalog derives the tag choices from installed plugins;
there is no tag registry. Multiple selected tags match any selected label and combine with text search; `pluginTag` and
`pluginSearch` are nuqs URL state and survive detail/back navigation. Existing plugins without
tags remain visible when no tag is selected. Names, descriptions and tags participate in text search.

Declare metadata in `definePlugin({ metadata: { tags, coverImage } })`, local
`plugin.config.ts` metadata, or the package.json `tags` / `coverImage` fields consumed by
`bitakit build`. Discovery and package builds preserve both fields. Covers are optional;
missing, unsafe or failed images use the plugin icon (or the standard puzzle fallback).

App Preferences uses the standard table and Radix ScrollArea in its owning visual package.
Search and page headings stay outside the scroll viewport. The same ScrollArea is exported
for composition; table scrolling is owned by that viewport rather than a nested native
scroll container. Preserve the theme focus token and Radix data-orientation selectors when
updating registry components. No app CSS is needed.

- Plugin catalog pagination uses nuqs `pluginPage` and `pluginPageSize` (5/10/20/50,
  default 10). Reset the page when search/tags/page size change, clamp stale page links,
  and retain page state through detail/back navigation. Keep pagination outside the scroll
  viewport. Match the existing Members filter buttons, including the dropdown chevron.
- Keep focus rings outside clipping ancestors. Align the catalog's table outer cells with
  its search and heading; retain inner column spacing and a small scroll focus gutter.
  Verify computed padding after rebuilding packages: a stale development CSS cache can
  retain removed styles or omit newly generated utilities.

- Protected organization settings must wait for an installed auth contract and render an
  actionable sign-in state when it settles without a user; never infer perpetual loading
  from an organization snapshot that has not loaded. Standalone organization demos without
  auth remain supported. Distinguish signed-out, management denied, and no selected
  organization with standard Empty composition; retain readable member profile details.

- Empty primitives use content-sized `flex-none` by default in every visual owner; parent
  flex layouts must not silently stretch some empty states to full-page height. Keep their
  shared padding/media/title/description and dashed theme border consistent. Authentication,
  management authorization and invitation email-verification failures are distinct states.

### Theme-management ownership

The online onboarding guide is `apps/docs/content/docs/concepts/theming.mdx`; definition,
Action/service, storage and CSS details live in `reference/theming.mdx`. Keep these aligned
with Shell's README and `packages/ui/THEME.md`. Distinguish app JSON discovered at build time,
runtime personal copies, CSS presets and host baseline CSS. Theme IDs come from the definition,
not filenames. The pre-paint script restores mode only, not personal theme tokens.

App Shell owns theme management and its Appearance experience. Keep the existing visual
finish as BitaKit Default; incoming sample CSS must not replace it. Discovery owns collecting
app theme files, while Shell owns runtime selection and editing. Persist user-created named
copies through the existing settings storage contract, not a parallel store or writes to
source files from the browser. Preserve original themes and light/dark variants. See
`packages/shell/README.md` for the theme file format and lifecycle.

Shell now registers the `themes` service through `defineService`/`provides`, with
`shell.selectTheme` and `shell.saveThemeCopy` using `defineAction`. The hidden user setting
`shell.themeLibrary` atomically owns selection and personal copies; no parallel persistence
or confirmed state exists. Additional theme definitions can be passed in Shell options.
Source-qualified keys distinguish Shell, app and personal themes; duplicate display names
are allowed. JSON tokens now project onto the document root with light/dark selection and cleanup on switching or unmount. Discovery collects app `src/themes/**/*.json`; Shell builds its bundled `themes/*.json`. Appearance uses standard controls and react-colorful for palette editing. Source file collection is build-time; personal persistence and switching are runtime.

Native scrollbar appearance is owned by the central theme base layer, including settings
page containers. Do not style individual pages to make their scrollbars thin. Radix
ScrollArea is still used where a constrained component owns scrolling (for example tables).

Custom settings pages may use the provided `renderField(field)` composition callback to
retain canonical SettingField behavior instead of recreating controls. Theme editing uses
`shell.updateTheme` for personal copies only; originals remain immutable. Draft previews
must stay scoped, including portaled dialogs, and must not mutate confirmed settings.

Standard settings sections retain their content minimum height inside the padded scroll
container; otherwise flex shrink lets descendants overflow past the bottom padding and clip
the last card. Header-owning constrained views retain `min-h-0` for their internal scrolling.

Theme choices reuse the existing shared Button and DropdownMenu radio primitives from
`@bitakit/ui/components`; do not copy Select into Shell or give these controls local visual
overrides. Color editing uses standard InputGroup composition. Preserve imported
custom radius/shadow/font values until the user chooses a replacement. White/transparent
swatches need a theme-token border; copy controls provide accessible success/failure feedback.

The central theme must cover Select triggers as well as Button triggers; verify both generated
settings and custom settings controls. A disabled shadow must preserve composed border/focus
rings. Save-and-apply retains the editor and updates the same personal theme on later saves.

Generated settings Select triggers now compose the existing shared Button through Radix
`asChild`, retaining combobox semantics and runtime setting behavior. Their popup uses
anchored positioning and standard menu padding; the Notification position open popup was
verified in the browser. Central shadow coverage alone did not correct trigger geometry.

Personal themes can be removed through `shell.deleteTheme` and the existing confirmation
flow. The service rejects deletion of original themes and atomically selects BitaKit
Default when removing the active personal theme. Theme options show source and light
palette swatches; same-name entries from the same source also show a display ordinal.
Color-picker pointer geometry is a functional circular exception in the central theme.

The theme preview has its own Light/Dark controls. They change draft preview tokens and
the sample dialog only, without writing `shell.mode` or applying the draft to the app.

SelectControl renders declared option icons via the existing icon binding. Density uses
the same cards control as layout. The Appearance notification test is a Shell action
using the existing notification service, not another toast implementation.

Better Auth UI re-exports its identical Button, Input, DropdownMenu, Field, Label, Badge,
Separator and Tooltip from the existing UI components entry. Do not restore copied
implementations for these controls; keep the owning package files as named export facades.

Quick Search includes plugin destinations by default alongside pages and settings;
`results.plugins: false` opts out. App Preferences owns their URL action projection.
Input-dependent action presentation must handle absent input during action enumeration.

### Authoring and migration workflow

For human or AI-assisted authoring: read the owning slot contracts with `bitakit info --json`
and generated SlotMap, use `bitakit add` templates, implement the smallest service/Action/UI
files, then generate, typecheck, Doctor and exercise the real outlet. Static unknowns require
source inspection, not guessed IDs. `add settings-page <plugin>` retains canonical fields;
App Preferences owns navigation/body projection. Explicit navigation migration requires
`--navigation-slot <target>`; preview and review, preserve groups, handle ambiguous spreads
manually. Run Core reconciliation/inventory, UI reconciliation/slot and CLI command tests when
changing these contracts. Never put private comparisons or test logs in public documentation.


### Developer documentation

- The canonical developer handbook is `apps/docs/content/docs`. Keep API explanations and
  tutorials there; package READMEs are short entry points linking to it. Use relative source links
  for repository navigation so they follow the current branch. Published README links must
  target a verified public handbook URL; do not assume new pages already exist on `main`
  or that repository-relative source links work from an npm installation.
  Root `docs/` holds development plans, architecture decisions and shared README assets, not
  another API manual. Transfer unique, verified content before removing an obsolete guide;
  update incoming links and package publication lists in the same change.

- Use TypeScript (`.ts`, or `.tsx` for React) for documentation and new feature examples by
  default. Derive types from the existing definitions and check snippets in strict mode;
  do not hide missing contracts with `any` or casts. Use JavaScript only for an explicitly
  JavaScript-focused example or an actual tool file. Standalone examples must name their
  execution requirements; running TypeScript with type stripping does not typecheck it.

- For help illustrations and architecture/flow diagrams, follow the canonical
  [visual style and reusable prompt](documentation-visuals.md). Use one consistent simplified
  UI style with clear callouts; supplement small code examples with accurate visuals showing
  where contributions render. Preserve the same style across future generations. Keep the
  clickable region with its code directly in the relevant subject section; do not add a
  separate visual gallery or repeat the same example below the explanation.

- Teach with one evolving feature: a page first, then a service, Action, slot and setting.
  Each first sample shows only fields needed for its visible result; no option catalog,
  lifecycle hook, dependency, schema, event or manifest until the lesson needs it.
- The Introduction gives the purpose, philosophy and an additive visual example first.
  Its first choice defines the plugin's identity with `definePlugin`/`plugin.config.ts`; the
  page is a separate next choice. In this overview, optional explicit Action/slot IDs are shown
  with a file-inference comment so their cross-plugin references are understandable.
  **Start here** then teaches the Counter step by step. Keep illustrative previews distinct
  from a future code playground; source examples must use the real APIs and owning slot contracts.
- Explain file conventions and programmatic APIs as two ways to compose the same plugin model.
  Predictable paths help both developers and AI coding agents find the owning feature. Automatic
  discovery assumes a configured adapter/provider and supported default exports; do not imply
  browser filesystem scanning or that registering an Action automatically renders a control.
- Present extensibility as local feature ownership and explicit service/event/slot contracts.
  These reduce accidental coupling and changes to shared foundations; do not promise that
  adding plugins cannot cause regressions or that folder boundaries enforce isolation.
- Introduce each learning-path concept in plain English before its first code block, with
  one concrete use and a descriptive Read more link. Explain "extension point" as a place
  other plugins can extend; distinguish declaring a slot from placing its UI outlet.
- State prerequisites, exact file paths, whether a block replaces a file or edits a property,
  and what the reader should see after the step. Keep one clear next link.
- Put complete property tables and independent advanced examples in reference pages.
  Preserve their depth; link from the short guide rather than inlining every option.
- Keep root/package/generated READMEs aligned with the learning path. Verify the documented
  snippets in a generated app; do not guess API shapes or imply an unpublished API is on npm.


## Runtime diagnostics

`runtime.lifecycle.get()` reports an active `operation` (`start`, `stop`, or `update`)
and its `startedAt` time. Plugin/service entries have `since` timestamps for their current
phase. Compute elapsed time at the observer; Core does not run a diagnostic timer.
`inspectRuntime()` includes those times and cleanup status, without raw errors or values.

| Read | Meaning | Not evidence of |
| --- | --- | --- |
| `inventory.live.slots[].count` | Attached contributions | Mounted or visible UI |
| `mountedOutlets`, `visibleCount`, `renderFailures` | `null`: not observed by Core | Zero outlets or errors |
| `useSlot(name).diagnostics` | This outlet's selected entries and exclusions | Successful render or on-screen visibility |
| `SlotRenderError` / recovery UI | A render failure, attributed to contribution and owner | A failed plugin lifecycle |

Outlet diagnostics name initialization, owner unavailability, update pending, payload
validation/failure, key/condition filtering, hidden/missing Actions and binding errors.
They contain identifiers and counts, never payloads or causes. Read them at the real
outlet; a second diagnostic outlet would have different context.

Devtools `Inspector` shows pending work with elapsed seconds. `stalledAfterMs` changes
its advisory threshold (default 10 seconds). Escalation is reporting/investigating the named
hook, then stopping the host process if necessary. A deadline never completes cleanup,
starts an overlapping replacement, cancels a promise or grants access. Static CLI inventory
continues to return `live: null`.


## Development refresh

Framework hosts generate a component-only `bitakit.gen.tsx` and a client-side
`bitakit.gen.config.ts` for configuration/type maps. Normal hosts keep importing
`BitaKitProvider` from `bitakit.gen`. Advanced consumers that previously imported
`createBitaKitConfig` there now import it from `bitakit.gen.config`. Without a framework,
`bitakit.gen.ts` remains the configuration entry. Do not hand-edit generated files.

The watcher writes complete files atomically and regenerates promptly on filesystem renames.
A watch session reuses its audited installed-package graph for local source-only changes;
package metadata, configuration selection, styles and external watched files invalidate it.
The cache contains package discovery results, never application values or a second runtime.

Next development checks cover add/edit/delete, whole-plugin removal and collection leaf removal,
with a preserved document token and page draft. This is bundler Fast Refresh followed by an
awaited composition replacement, not `reconcilePlugins` or arbitrary code hot replacement.
Affected slot/form state can remount during composition replacement; compatible explicit
runtime updates retain Phase 8's owner-specific guarantees. Named components are the supported
React refresh path. Structural provider changes, server code, dependency installation and
changes outside a React refresh boundary can require a host restart/reload. Restart the dev
server after changing Node-loaded generator/integration code. No universal HMR promise.


## Shared layouts and extension regions

Shell owns `brand`, `header.start/center/end`, `header.rows`, contextual `header.row.start/end`,
`content.before/after`, `footer`, `drawer.header/body/footer`, `navigation.group.before/after`
and optional `state.content/actions` under the `shell.` prefix. Existing `sidebar.header/footer`,
`sidebar.body`, `app-bar.end` and the Action slots `shell.navigation` and `shell.toolbar` remain explicit contracts.
`ShellSurface` is the shared base for `AppShell.Content` and `AppShell.FullPage`; named layouts
use the existing `src/layouts/` convention. `blank` remains bare. Render children once.

Use `AppShell.HeaderRow` with a unique row ID, `AppShell.NavigationGroup` with an explicit Action
slot, and `AppShell.Drawer` with a unique drawer ID. Contributions filter rowId/groupId/drawerId
through `when`; omitting it intentionally selects all occurrences. Radix Sheet retains focus
and modality; side is logical start/end, with explicit/inherited Radix direction.

`PageState`/error helpers accept `content` for composition and optional `surfaceId` for keyed
message/list recovery regions. Core is never required for host-owned fallback/retry. Optional
regions are guarded against missing/stopped runtimes and client render failures. This does not
catch SSR or arbitrary asynchronous errors. Essential recovery stays outside failing plugins.

App Preferences additionally owns `navigation.header`, `navigation.group.before/after` with
`groupId`, and `page.header/before/footer` with `pageId`. Page regions remain inside the existing
page access boundary. Navigation-shell regions are not protected by an individual page boundary.
No second Settings catalog, store, route registry or layout engine is introduced.

Progressive examples and the full region table: `apps/docs/content/docs/reference/layouts.mdx`.

Hand-composed Shell/Preferences packages derive `foundation.slots.json` during their build,
using the same static `describeDefinitions` parser and sidecar contract as `bitakit build`.
Do not maintain a second list of region IDs or import client entries during discovery.
The ordinary package build must run before packed-consumer inspection/Doctor.
Mobile Sidebar uses one Radix Sheet root around its trigger and content; preserve that relation
so Escape restores focus and `aria-expanded` follows the actual open state.
