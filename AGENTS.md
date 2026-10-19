# Project conventions

## Product intent

BitaKit is a composition layer for building apps with AI agents. Every feature is a
self-contained plugin with a predictable place and explicit contracts, so a developer or an agent
extends an app with a small, local change. Design test for every change: can a developer or an
agent add this by changing only their own feature folder? If not, the missing mechanism belongs
in a package, not in the app.

## Private working documents

- Keep private analyses, architecture proposals, working TODOs, phase plans and review notes under the Git-ignored `.private/` directory. Do not stage, force-add, copy into tracked docs, publish or upload them without an explicit user request.
- Keep external comparison studies and superseded input proposals outside the project in a private local archive. Active BitaKit plans and verification remain in `.private/`; retain recoverable originals when removing old research from the checkout.
- Continue an existing workstream from its current proposal and TODO. Record decisions, verification and the next step there; do not recreate the study or restart its phase numbering.
- Current architecture work: `.private/bitakit-enhancement/README.md` links to the proposal, phased TODO and review. Private files may be absent in another checkout; their absence is not permission to invent previously agreed decisions.
- Existing tracked project documentation remains historical or public API guidance; new private working notes go in `.private/`. Update public API documentation only with implemented changes. Git ignores do not remove previously tracked files or their history.

## Cost-aware test execution

- The user authorizes a narrowly scoped test subagent for substantial test runs. Prefer `gpt-6-luna` with low reasoning effort, a fresh context and an explicit command/file scope. Do not copy the whole conversation. If that model is unavailable, report it rather than silently selecting a more expensive model.
- Run small deterministic checks directly with bounded output. Delegate only when the expected test/log-analysis work justifies agent overhead. One test worker by default; no nested delegation or autonomous source edits.
- Keep full logs in `.private/test-runs/`; return commands, exit codes, counts, failing tests and short relevant excerpts. The main agent owns fixes and complex analysis. Do not run an unchanged suite twice without a concrete reason; do not skip required verification to save tokens.

## URL state

- Use **nuqs** by default for URL query parameters and URL-backed UI state: search, filters, pagination, tabs, and selection position. Use typed parsers and explicit defaults. Read the current official docs at https://nuqs.dev/docs when implementing it.
- The URL is the source of truth for this state. Do not mirror it into Zustand or maintain a second synchronized state store.
- Use Next.js routing for routes/pathnames and the browser/router for hash navigation. nuqs is not a replacement router.
- Do not invent URL state or migrate existing paths just to introduce nuqs. Install it and its appropriate Next.js adapter when the first actual query-state feature is implemented. Settings search now uses nuqs through the root App Router adapter.

## Icons

- Use **Reicon Outline** for application UI icons. Import verified components directly from `reicon-react/icons/Name`; the pinned package defaults to `Outline` and inherits currentColor.
- Preserve accessible text/labels. Decorative icons use `aria-hidden="true"`; icon-only controls need accessible names. Keep existing shadcn sizing via className/data-icon.
- Keep packages/core/src/actions independent of any icon library. Do not introduce icon name lookup registries or a second UI icon package.
- The shadcn CLI does not currently offer a Reicon mapping. `components.json` retains the supported Lucide scaffolding preset only; after generating/updating a component, translate generated icons to verified Reicon imports and remove any reintroduced Lucide dependency before completing the change. Existing runtime UI uses Reicon.
- Existing inline Apple/Google marks in disabled sign-in buttons are brand assets, not the UI icon library; do not silently replace brand identities with generic symbols.
- See THIRD_PARTY_NOTICES.md for Reicon's MIT notice and upstream icon credits.

## Component organization

- In an app, group feature components under `src/components/<feature>`: organizations in `organizations`, authentication in `auth`, shared page shells in `layout`, navigation renderers in `navigation`, and reusable primitives in `ui`. Avoid adding feature components directly to the components root.
- Settings-specific content stays with its section under `src/settings/sections`; reusable settings shells stay under `components/settings/base`. Prefer direct imports and keep the folder structure shallow.

## Standardlösungen vor Eigenentwicklung

- Verbindliche Nutzerentscheidung: Immer vorhandene Standardkomponenten und geeignete, etablierte Bibliotheken verwenden. Bereits verfügbare Funktionalität nicht selbst nachbauen — insbesondere Validierung, Formulare, UI und Infrastruktur.
- Wenn keine passende Standardlösung vorhanden ist oder eine eigene Erweiterung nötig erscheint: zuerst die konkrete Lücke, verfügbare Alternativen und den vorgeschlagenen eigenen Code erklären und ausdrückliche Zustimmung einholen. Ohne diese Zustimmung keine eigene Ersatzlösung oder zusätzlichen Validierungsregeln implementieren.
- Die Konfiguration und reguläre Anbindung vorhandener Bibliotheken ist weiterhin erlaubt. Individuelle Produktregeln dürfen nicht stillschweigend erfunden werden.

## UI style

- Verbindlich: Immer vorhandene zentrale UI-Komponenten und die zentralen Theme-Vorgaben verwenden. Karten, Rahmen, Radius, Abstände und Typografie dürfen keine lokalen/custom Stilabweichungen erhalten. Eigene visuelle Anpassungen nur auf ausdrücklichen Nutzerauftrag; autorisierte Anpassungen möglichst zentral umsetzen. Wenn die zentralen Komponenten nicht ausreichen, keine selbst erfundene visuelle Sonderlösung stillschweigend hinzufügen, sondern die konkrete Lücke benennen. Die Wiederverwendung vorhandener Komponenten erfordert keine erneute Bestätigung.

- Use the official **Radix Vega** component sizes, spacing and typography as the base (shadcn style `radix-vega`). Prefer built-in `default`, `sm`, `lg`, `icon` variants over custom dimensions.
- Preserve the intentional theme changes when updating registry components: central radius 0.875rem, XL Squircle surfaces and buttons, Medium round text inputs, XL round badges, functional circle exceptions, Reicon Outline and persistent light/dark theme.
- Inspect registry changes with the shadcn CLI dry-run/diff and merge them; do not replace customized components blindly. README records the current base and deviations.

## Settings and theme

- Settings are declared once per plugin in `settings.ts` with `defineSettings({ name: setting({ default, schema?, scope?, control?, options? }) }, { title, category, order, path, shortcut })`; keys are `<plugin>.<name>` (plain names for the app). Core's runtime store is the only owner of confirmed values; read and write through `settings.<plugin>.<name>` in services and actions and `useSetting(key)` in React. No second value store, section registry, renderer registry or forwarding action (`theme.set`, `locale.set`).
- Persistence is the `settings.storage` contract (browser storage by default; one host service with `provides: settingsStorage` for a server). Server storage re-reads the trusted `settings.ts` files and applies its own access rules; client declarations grant no persistence access. Identity follows the `auth` contract.
- `@bitakit/app-preferences` renders a generated page per plugin under `/settings` (`SettingsRoute`, `SettingsShell`, `SettingField`, controls) and projects pages into URL actions; `ui/settings/page.tsx` replaces a plugin's page. Shell owns appearance settings (`shell.mode`, `shell.layout`, `shell.preset`, `shell.density`, `shell.corners`, `shell.toasts`) and applies them to `<html>`; theme presets are CSS under `[data-theme-preset="<id>"]`.

## Authentication and organizations

- Better Auth möglichst unverändert verwenden: native Komponenten, APIs und Datenverträge bevorzugen; Customization auf notwendige BitaKit-Anbindung und ausdrücklich vereinbarte Darstellung begrenzen. Keine parallelen eigenen Auth-/Organisationsmechanismen. Weitergehende Eigenlösungen vorher mit dem Nutzer abstimmen.

- Better Auth owns authentication and Organization plugin membership/role checks; ZenStack is the server-only database adapter. Do not reintroduce Strapi or parallel Supabase Auth sessions.
- Never expose auth/session/account/member tables through generic CRUD. Auth tables have database RLS and revoked Supabase public-role grants; preserve those migration protections.
- Use the verified server session and plugin APIs for organization operations. An active organization ID alone is not proof of membership. A membership with `disabled: true` grants no organization access; preserve the Better Auth suspension hooks and filter disabled memberships in direct server data access. Future domain/data models need explicit tenant policies and cross-organization tests.
- Keep credentials in ignored local env files. Postgres connections must verify TLS and hostname using the Supabase CA. Generate schemas before typechecking/building and use tracked migrations; never reset a shared database.
- Email verification, password-reset mail and invitation delivery require a real sender; they are not configured by the current test foundation.

## Platform actions

- Keep `packages/core/src/actions` router/UI/settings independent. Host metadata and the execution environment are opaque core extension points; the ActionList lives in `packages/core/src/actions`, the one action adapter in `packages/core/src/contributions`; application behavior lives in `src/plugins/<id>/actions` or the app's `src/actions`.
- `defineAction({ ... })` is the only action shape. Presentation fields (`title`, `enabled`, `visible`, `icon`, `href`, ...) take a value or a function of `{ input, services, config, app }` that re-runs when a service store changes; `href`, `dialog`, `input` (schema), `confirm`, `concurrency` and `success`/`failure` are options. Do not reintroduce `defineURLAction`, `defineDialogAction`, form actions, class or factory action exports, `resolve`/`watch`, `events`/`onEvent`, `setup` or `initialState` on actions; state belongs in a service `store()`.
- Use the single root ActionList, with globally unique action IDs (`<plugin>.<file>`). Group IDs express logical membership, not UI placement or action namespaces. Explicit Action `slots` add owned references; renderers bind each placement with its outlet input. Do not nest a second ActionProvider for app pages/dialogs.
- Register a contribution once with all placements and preserve its cleanup handle. All renderers read current snapshots; no copied title/icon/enabled/visible state.
- Navigation actions read the current href at execution. Render real navigation as links without also executing handlers. Preserve safe URL validation, native new-tab semantics, and disabled/hidden guards. Navigation dispatch completion is not route-load completion.
- Discovery generates typed `ActionMap`, `ServiceMap`, `EventMap`, `ConfigMap` and `SlotMap` augmentations into `src/bitakit.gen.tsx`; strict action IDs are on by default in generated apps. Registrations flagged `internal` must stay out of every action enumeration.
- Keep the foundation generic. The public Course Studio is historical demo code, not the product's architecture or a mandate for new domain models.

## Localization

- App UI translations live in the app's `locales/<lang>.json`, organized by feature namespaces. Use next-intl for client/server translations and locale-aware formatting; keep matching keys in both catalogs. Plugins ship their own catalogs in `locales/<lang>.json` under their namespace; discovery merges them into `src/bitakit.gen.messages.json`.
- Locale is a validated browser cookie, resolved by `src/i18n/request.ts`. Keep existing paths/intercepted Settings routes. Do not duplicate locale in a second store or add URL locale prefixes without a product requirement.
- The interface language is a setting (`defineSettings`, for example `language.locale` from `@bitakit/next-intl/preferences`); the host's `settings.storage` service validates and saves it. Preserve mounted application state on language changes. User-authored content and historical sample content are not translated automatically.

## Action and Settings organization

- Action classes, the registry, execution and subscriptions belong to packages/core/src/actions. React hooks and generic UI bindings belong to packages/ui. Do not rebuild these in the app or add app ActionButton/ActionLink wrappers, per-action hooks, or bootstrap effects.
- App actions are discovered from `src/plugins/<id>/actions/<name>.ts` and `src/actions/<name>.ts` (a folder and a dot mean the same, so flat `actions.add.ts` and a record file `actions.ts` exporting `{ add, remove }` declare the same IDs; folders are the default and flat files are equally fine; `bitakit migrate` is the 0.1 upgrade and moves dotted files into folders (record files stay), so do not run it to tidy a flat plugin) through `@bitakit/discovery`. The generated `BitaKitProvider` in `src/bitakit.gen.tsx` owns the single root ActionList. Do not restore a manual per-action registry. Normal usage is define, discover, bind.
- Use `<Action id input kind>` from `@bitakit/ui` to bind any control, `ActionButton`/`ActionLink` as sugar, `useAction` with its prop getters for custom controls and `useSlot` for explicit menu/navigation placements; `useActionGroup` remains a logical query. Disabled/hidden/pending guards and execution belong to the package. Do not recreate the removed `ActionBinding`, `ActionCheckbox`, `ActionRadioGroup`, `ActionMenuItem`, `ActionGroupBinding`, `ActionMenuView` or `useRegisterActions`.
- Read service state with `useServiceState(name, selector, fallback)` and `useService`; observe events with `useEvent`; check availability with `app.has(name)` instead of the removed `app.optional.services`.
- Keep the package in small focused files. Core exports are separate from implementation; class state, registration, execution, lifecycle, React hooks and components have explicit modules.
- Settings pages are automatically projected into App Preferences navigation/keyed body slots; extensions use `app-preferences.page.after` and contextual toolbar Actions. A page `boundary` wraps its content and extensions using the owner's existing access policy.
- Settings pages are generated from `defineSettings`; a plugin that needs custom content adds `ui/settings/page.tsx`. Hosts mount `SettingsRoute` from `@bitakit/app-preferences` (or compose `SettingsShell` and `SettingsPage`) instead of writing settings shells, navigation or section registries.

## BitaKit-Entwicklungsleitfaden

Vor Änderungen an BitaKit-Packages, Actions, Plugins, Integrationen oder Beispiel-Apps den projektspezifischen [Skill zur BitaKit-Entwicklung](.agents/skills/foundation-development/SKILL.md) lesen. Er dokumentiert die vereinbarten Konventionen, die `define*`-Formen, die React-Bindings, die Paketgrenzen und den Prüfablauf; die Historie früherer Reviews steht lokal in `.private/bitakit-enhancement/review-history.md` (nicht im Repository).

Bei Architektur- oder API-Änderungen und neuen bestätigten Integrationsfehlern den Skill im selben Arbeitsschritt aktualisieren und veraltete Aussagen entfernen. Die Übereinstimmung mit dem implementierten Stand gehört zur Abschlussprüfung.

## Runtime lifecycle

- Await `runtime.stop()` (or the mount cleanup) before replacement. Cleanup is async, reverse ordered and idempotent; failures aggregate after all disposers run. Do not await an enclosing runtime's stop from its own hook or Action.
- Reuse Core's `createRuntimeController` for fail-fast/isolation policy. React retains the previous cleanup barrier across replacements. `runtime.lifecycle.get()/watch()` owns retained execution state; `runtime.lifecycle` events only notify.
- Missing service reads always throw, including `auth` and `i18n`; optional consumers check `app.has(name)` first. `requires` remains consumer-owned. No slot or incremental replacement API is implied by this lifecycle contract.

## Package boundary

- `@bitakit/core` owns the framework-independent runtime, the `define*` helpers and Actions. Core has no React dependency, React types, or UI renderer exports; React bindings belong to @bitakit/ui. Settings remains independently usable.
- Provider-specific adapters belong to optional packages, never Core. Register them as ordinary plugins, not a parallel integration system. Packages opt into discovery with `bitakit: { plugin: './plugin' }` in `package.json`; `bitakit build` produces that entry.
- Use shared typed contracts (`defineContract`, `provides`) for plugin services; declare required services with `requires` and preserve server/client separation.

## Minimal host application code

- Reuse the existing BitaKit architecture and package APIs before adding host code. Keep application code limited to product behavior, native framework routes, and essential composition/configuration (`next.config.ts` with `withBitaKit`, `<BitaKitProvider>` in the root layout, optional `bitakit.config.ts`).
- Core already manages service registration, plugin lifecycle, and plugin-provided providers. The Better Auth adapter already registers the shared authentication service. Use these mechanisms; do not introduce a parallel registry, provider bootstrap, session store, or authentication binding in the app.
- Keep reusable provider-specific wiring in its optional adapter package, not Core or duplicated host files. Preserve server/client boundaries and explicit server configuration.
- Before adding host infrastructure, identify the concrete gap in existing package APIs. Moving boilerplate to another app folder is not simplification. Do not add wrappers or abstractions solely to reduce visible line count.
- Keep demo/catalog code separate from required application integration so it can be removed independently. Preserve native framework routing for app-owned pages.
- Never edit generated files (`src/bitakit.gen.*`); they are ignored by Git and rewritten by discovery.
- Write all new documentation, development guidance, and code comments in English, regardless of conversation language. Product localization catalogs are separate from this rule.
- Use English source identifiers. Document public APIs and important non-obvious functions with concise purpose, ownership/lifecycle constraints and relevant failure behavior. Keep comments aligned with implementation; explain decisions and invariants rather than restating individual statements.
- Remove superseded or unused project material after checking references. Update affected skills, examples and documentation with each implementation change; preserve required migrations, compatibility contracts and verification evidence.

## Headless Core and generic UI bindings

- Core must remain usable on the backend without React or a UI library. Presentation payloads are opaque extension types; Core never renders them. React belongs under `ui/` of a plugin; nothing outside `ui/` may import React.
- The `@bitakit/ui` root entry contains generic bindings and host-driven rendering only and does not re-export Core; `define*` always come from `@bitakit/core`. Standard shadcn/Radix Vega primitives live only in the optional `@bitakit/ui/components` entry and use the central theme tokens. Do not add other visual libraries (HeroUI, copied components) to this package.
- Apps and optional visual plugins own only their required UI components. Visual plugins never import app code or request a host component catalog. They consume generic action bindings from packages/ui and inherit the central application CSS theme tokens.
- Do not replace removed primitives with another central component-library package. Keep standard library components in the consuming app, and keep business execution/guards in Core.

## Live updates and inspection

- Explicit host `runtime.reconcilePlugins(nextPlugins)` supports compatible already-loaded
  definitions; retain unchanged references and await its result. For that method, membership,
  identity and provider changes require composition replacement. Use host-only runtime.plugins
  add/remove/enable/disable for supported structural membership, with explicit dependent policy. Failed cleanup blocks reuse. Never invoke and await
  updates from affected owned work. Provider config changes and file HMR are separate paths.
- Read shared inventory through Core `inspectRuntime`/`observeRuntimeInventory`, UI
  `useRuntimeInventory`, or CLI `info --json`. Version 1 separates static/live data and preserves
  null unavailable fields. Values, defaults, raw errors and executable payloads stay out of
  snapshots; interactive Devtools still uses its existing execution/store APIs.
  `useRuntimeInventory` returns `live: null` during server rendering and hydration (the runtime
  starts only in the browser); every React hook that reads runtime state needs a fixed server
  snapshot so lazily hydrated routes cannot mismatch.
- `bitakit add settings-page <plugin>` preserves automatic Settings registration. Navigation
  migration is explicit (`--navigation-slot` plus preview); grouping never implies placement.

## Slot render recovery

- `PluginSlot` isolates component render errors automatically using the standard React boundary
  library. Custom `useSlot` renderers may use `SlotErrorBoundary` per entry, inside access controls.
  Recovery retries only that occurrence; keep stable entry keys and never reset on global revision
  or unstable payload identity. Default recovery hides raw causes; `SlotRenderError` goes to the
  existing local `actionOptions.onError` callback. Core lifecycle/inventory remains separate.
