# Settings and App Preferences architecture

App Preferences are a client application feature: user-facing values (theme, layout, locale, …),
their presentation, and a replaceable storage adapter. They are not a server plugin framework.
Technical configuration stays in the Configuration mechanism (`configs/`, `ConfigService`).
A remote adapter calls an independently owned backend API, which authenticates, authorizes and
validates on its own. The existing package was renamed to `@bitakit/app-preferences`; stored preference keys and Settings routes are unchanged.

API reference and examples: `packages/app-preferences/README.md`.

## Implementation map (verified before the change)

| Area | Existing and reused | Gap closed |
| --- | --- | --- |
| Definitions | `Setting`, `SelectSetting`, `ToggleSetting`, `TextSetting`, `NumberSetting` with namespaced keys and `parse` | Collections with explicit IDs (`defineSettings`), typed field builders, Standard Schema validation, localization keys, presentation hints |
| Values | `AppPreferences` with revision guards, confirmed values and subscriptions | Owner-based, reference-aware registration independent of sections; queued, coalesced writes with defined promise results; `reset`; `loadMany`; per-context sessions |
| Catalog | `SettingsCatalog`, `SettingsSection`, `projectSettings`, hydration snapshot | Sections reference collections; automatic field ordering; section `order`; localized titles |
| Storage | Host-written adapters (web server actions, inline local storage in Content Demo) | Documented contract plus `createLocalStorage` and `createMemoryStorage` |
| Rendering | `instanceof` dispatch in `SettingsSectionContent`, `SettingSelect` `as` components | Typed renderer service with field/type/section/view overrides, layered precedence, owner scoping, default views |
| Core | Plugins, typed services, `PluginScope` cleanup, dependency ordering, provider plugins | Generic `contributions`/`installs` (augmentable `ContributionMap`), pure `contributionsOf()`, `scopeModule()` for runtime-issued scopes |
| Discovery | Folder-kind mapping, directory overrides, manifest `entries`, runtime normalizers with source paths | Integration `kinds` (folder + normalizer) so Settings adds `settings/`, `sections/`, `renderers/` without Core knowing them |
| First render | Services are created in `mount()`, after the first render | Pre-mount snapshot derived from static contributions, identical to the mounted state |

New infrastructure was limited to what the gaps required: Core got a generic contribution route
and discovery kinds (no Settings semantics); everything Settings-specific lives in the optional
`@bitakit/app-preferences/foundation` entry.

## Model

- **Definitions** are React-free. Keys are `${collectionId}.${fieldName}`; moving a field between
  sections or renaming a file does not change its key.
- **Ownership.** `AppPreferences` alone holds confirmed values. Modules register collections as owners;
  several owners of the same definition object are legitimate, a different definition under an
  existing key is an error naming both origins. Sections only reference definitions. Removing the
  last section or a plugin never deletes persisted values.
- **Writes.** One in-flight write per key, newer values coalesce into the follow-up write. Promises
  resolve `saved`, `superseded` or `cancelled` and reject only for validation or their own write
  failure. Context changes start a new session; stale responses never reach it.
- **Rendering.** One application-scoped renderer service (`settings.renderer`). Resolution order:
  app field > owner plugin field > app type+variant > owner plugin type+variant > built-in variant >
  app type > owner plugin type > built-in type. Unknown variants are configuration errors. Plugin
  renderers cannot restyle other modules' fields or sections; views are app-only. Imperative
  registration uses `service.scoped(app)`, so layer and owner come from the runtime-issued scope.
- **Initial render.** The `appPreferencesPlugin` provider derives a pure, instance-scoped snapshot from
  `runtime.contributionsOf()` in install order. Server render, hydration and post-mount render
  resolve the same renderers for static contributions; nothing is stored in module globals.
- **Discovery.** `foundation.config.ts` adds `kinds: settingsDiscovery()`. Generation emits imports;
  normalizers validate exports at import time with the source file; installers register values for
  the contributing module and Core owns their cleanup.

## Web application (unchanged architecture)

- Definitions: `apps/web/src/settings/definitions.ts`, shared with trusted server code.
- Sections: `apps/web/src/settings/sections`; registration through `settings/standard-settings.ts`,
  installed by `providers/settings-provider.tsx` with the legacy `add()` API.
- Storage adapter: `settings/storage.ts`; server validation and authorization under `settings/server`.
- UI: `@bitakit/shell/settings` owns the router-independent frame and catalog navigation;
  `components/settings/base` keeps thin Next.js adapters and the intercepted dialog.

User settings derive ownership from the verified session. Organization-scoped definitions check
membership for reads and owner/admin membership for writes. Global writers require explicit
`APP_SETTINGS_ADMIN_IDS`. The client user ID is only an expected-identity precondition. Database
values are JSONB records identified by scope, owner and key; public Supabase roles have no table
access; no client-selected owner key is accepted. `APP_DEFAULT_THEME` and `APP_DEFAULT_LOCALE` are
resolved on the server; stored values win.

Guests keep only `appearance.theme` (browser cache) and `language.locale` (cookie). Other
user-scoped keys read as not writable for guests and guest writes are rejected, so no write is
reported as saved when nothing would persist it. Theme local storage is a display cache for
signed-in users; the database remains authoritative. Theme storage events refresh the binding.

## Catalog and plugin-owned pages

Each module owns its sections (`pluginId`). Contributed sections receive the contributing module as
`pluginId`; the Shell plugin overview groups pages by it. The host supplies categories, which are
presentation only. There is no API for inserting fields into another module's section. The legacy
`add(page, { section })` parent grouping remains; shared parents must be host-owned, and children
inherit the parent's category.

`SettingsProvider` keeps the initial catalog for hydration; before a Foundation runtime mounts,
statically contributed sections are included, so navigation matches between server and client.
Direct access to unavailable pages renders the unavailable view after catalog readiness; unknown
Web settings paths still start with HTTP 200. This is not server authorization.

## Appearance contracts

- Shell contributes `shellPreferences` (`shell.theme`, `shell.layout`, keys unchanged), its
  Appearance and plugin-management sections, and plugin-layer renderers: icon card field renderers
  and an Appearance section layout. It requires `appPreferencesPlugin` in the same Foundation; without it
  mount fails with an actionable error. The DOM theme projection stays in Shell `setup`.
- Content Demo uses `createLocalStorage({ prefix: 'content-demo.settings.' })`, so existing browser
  values keep working, no longer pins the Shell definitions, and passes German messages to
  `appPreferencesPlugin`.
- A host can pass its own compatible theme definition (`shellPlugin({ theme, applyTheme: false })`);
  Shell then co-owns that definition and does not register `shell.theme`.
- Web keeps `appearance.theme` with its existing DOM/system/cache adapter and the legacy API.

## Migration scope and status

| Consumer | Status |
| --- | --- |
| App Preferences package | Migrated; legacy APIs kept and covered by the original tests |
| Core runtime and discovery | Generic contributions and kinds added; existing behavior unchanged |
| Shell | First real consumer: declarative contributions, renderers, `SettingsSectionView` pages |
| Content Demo | Uses `appPreferencesPlugin`, the local adapter and discovery kinds |
| Web | Renamed package, plugin and renderer discovery enabled; appearance and language use SettingsField; existing catalog/routes/storage retained |
| Better Auth UI | Unchanged; in Content Demo its component sections render through `SettingsSectionView` |

## Limitations and deferred work

- Values from client storage load after activation, so the first render shows defaults (disabled).
- Pre-mount text uses fallbacks until Foundation translations are installed on mount.
- Sections cannot be extended by other modules; an app can override a section renderer or add its
  own section.
- Development refresh rebuilds the runtime; incremental hot registration is not implemented.
- Deferred: package rename, general client/server contribution environments, server preferences
  plugin or generated backend lists, encrypted storage, cross-device conflict protocols, locks and
  inheritance, a large adapter catalog, application-wide live preview, multi-select or structured
  values.


## Follow-up migration

App Preferences now owns standard shadcn Radix Vega controls instead of hand-styled native replacements.
Shell shares its choice-card renderer. Web installs `appPreferencesPlugin` and discovers its appearance
renderer; its preference fields use the new renderer pipeline while its existing localized catalog,
server persistence and intercepted Settings dialog remain in place. Better Auth UI retains its native
account/organization views and consumes the renamed package. Custom default renderers are passed to
both initial and mounted rendering. Multi-choice, horizontal/vertical choices and responsive columns
are supported. No separate backend preferences runtime was added.
