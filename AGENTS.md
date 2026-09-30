# Project conventions

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

- Group feature components under `apps/web/src/components/<feature>`: organizations in `organizations`, authentication in `auth`, shared page shells in `layout`, navigation renderers in `navigation`, and reusable primitives in `ui`. Avoid adding feature components directly to the components root.
- Settings-specific content stays with its section under `src/settings/sections`; reusable settings shells stay under `components/settings/base`. Prefer direct imports and keep the folder structure shallow.

## Standardlösungen vor Eigenentwicklung

- Verbindliche Nutzerentscheidung: Immer vorhandene Standardkomponenten und geeignete, etablierte Bibliotheken verwenden. Bereits verfügbare Funktionalität nicht selbst nachbauen — insbesondere Validierung, Formulare, UI und Infrastruktur.
- Wenn keine passende Standardlösung vorhanden ist oder eine eigene Erweiterung nötig erscheint: zuerst die konkrete Lücke, verfügbare Alternativen und den vorgeschlagenen eigenen Code erklären und ausdrückliche Zustimmung einholen. Ohne diese Zustimmung keine eigene Ersatzlösung oder zusätzlichen Validierungsregeln implementieren.
- Die Konfiguration und reguläre Anbindung vorhandener Bibliotheken ist weiterhin erlaubt. Individuelle Produktregeln dürfen nicht stillschweigend erfunden werden.

## UI style

- Verbindlich: Immer vorhandene zentrale UI-Komponenten und die zentralen Theme-Vorgaben verwenden. Karten, Rahmen, Radius, Abstände und Typografie dürfen keine lokalen/custom Stilabweichungen erhalten. Eigene visuelle Anpassungen nur auf ausdrücklichen Nutzerauftrag; autorisierte Anpassungen möglichst zentral umsetzen. Wenn die zentralen Komponenten nicht ausreichen, keine selbst erfundene visuelle Sonderlösung stillschweigend hinzufügen, sondern die konkrete Lücke benennen. Die Wiederverwendung vorhandener Komponenten erfordert keine erneute Bestätigung.

- Use the official **Radix Vega** component sizes, spacing and typography as the base (`apps/web/components.json`: `radix-vega`). Prefer built-in `default`, `sm`, `lg`, `icon` variants over custom dimensions.
- Preserve the intentional theme changes when updating registry components: central radius 0.875rem, XL Squircle surfaces and buttons, Medium round text inputs, XL round badges, functional circle exceptions, Reicon Outline and persistent light/dark theme.
- Inspect registry changes with the shadcn CLI dry-run/diff and merge them; do not replace customized components blindly. README records the current base and deviations.

## Settings and theme

- Settings live independently in `packages/app-preferences`; app sections are registered through `settings/standard-settings.ts`. The Settings catalog is the sole section registry. Do not reintroduce SettingsAction as the settings source or add a plugin loader.
- AppPreferences owns confirmed theme/locale values and persistence. Settings fields use package controls/useSetting directly; optional ThemeAction/LocaleAction forward writes and subscribe to the same values. Preserve the theme store only as the DOM/system-theme/cache adapter, not a second authoritative preference store.
- Preserve the intercepted Settings dialog under `app/app-preview`: opening settings must retain the mounted studio and its unsaved state. Use `SettingsLink` inside shared settings content (replace in dialog, normal navigation on direct pages). Direct Settings loads use a safe internal studio link; never trust a return URL or assume history is internal.

## Authentication and organizations

- Better Auth möglichst unverändert verwenden: native Komponenten, APIs und Datenverträge bevorzugen; Customization auf notwendige Foundation-Anbindung und ausdrücklich vereinbarte Darstellung begrenzen. Keine parallelen eigenen Auth-/Organisationsmechanismen. Weitergehende Eigenlösungen vorher mit dem Nutzer abstimmen.

- Better Auth owns authentication and Organization plugin membership/role checks; ZenStack is the server-only database adapter. Do not reintroduce Strapi or parallel Supabase Auth sessions.
- Never expose auth/session/account/member tables through generic CRUD. Auth tables have database RLS and revoked Supabase public-role grants; preserve those migration protections.
- Use the verified server session and plugin APIs for organization operations. An active organization ID alone is not proof of membership. A membership with `disabled: true` grants no organization access; preserve the Better Auth suspension hooks and filter disabled memberships in direct server data access. Future domain/data models need explicit tenant policies and cross-organization tests.
- Keep credentials in ignored local env files. Postgres connections must verify TLS and hostname using the Supabase CA. Generate schemas before typechecking/building and use tracked migrations; never reset a shared database.
- Email verification, password-reset mail and invitation delivery require a real sender; they are not configured by the current test foundation.

## Platform actions

- Keep `packages/core/src/actions` router/UI/settings independent. Host metadata, execution environment and pre-commit validation are opaque core extension points; base classes and platform projection/validation live in `packages/core/src/actions`; concrete application behavior lives under `apps/web/src/actions`.
- Use the single root ActionList, with globally unique action IDs. Placement group IDs are presentation grouping, not action namespaces. Do not nest a second ActionProvider for app pages/dialogs.
- Register a contribution once with all placements and preserve its cleanup handle (or use the registration hook). All renderers read current snapshots; no copied title/icon/enabled/visible state.
- URLAction reads the current href at execution. Render real navigation as links without also executing handlers. Preserve safe URL validation, native new-tab semantics, and disabled/hidden guards. Navigation dispatch completion is not route-load completion.
- Contribution kinds are normalized by adapters in `packages/core/src/contributions`; the runtime only registers. Discovery generates a typed `ActionMap`: prefer typed `useAction`/`ActionButton` IDs and declare `defineAction<Input>` where UI passes input. Registrations flagged `internal` (form submits) must stay out of every action enumeration.
- Keep the foundation generic. The public Course Studio is historical demo code, not the product's architecture or a mandate for new domain models.

## Localization

- UI translations live in `apps/web/locales/en.json` and `de.json`, organized by feature namespaces. Use next-intl for client/server translations and locale-aware formatting; keep matching keys in both catalogs.
- Locale is a validated browser cookie, resolved by `src/i18n/request.ts`. Keep existing paths/intercepted Settings routes. Do not duplicate locale in a second store or add URL locale prefixes without a product requirement.
- Language settings write through AppPreferences; the optional root `locale.set` action forwards to the same setting. The server validates and saves the preference. Preserve mounted application state on language changes. User-authored content and historical sample content are not translated automatically.

## Action and Settings organization

- Action/URLAction classes, registry, execution, and subscriptions belong to packages/core/src/actions. React hooks and generic UI bindings belong to packages/ui. Do not rebuild these in the app or add app ActionButton/ActionLink wrappers, per-action hooks, or bootstrap effects.
- App Actions are discovered from `src/actions/**/*.action.ts` (also form-action/dialog-action suffixes) through the generic `@bitakit/core/discovery` generator. `src/providers/actions-provider.tsx` owns the single root ActionList and composes the FoundationProvider. Do not restore a manual per-action registry. Explicit runtime registration remains available. App actions contain business behavior; normal usage is define, discover, bind.
- Use package ActionButton/Checkbox/RadioGroup with `as` for app UI. Use the shared useAction hook or ActionBinding for custom controls. Disabled/hidden/pending guards and execution belong to the package.
- Keep the package in small focused files. Core exports are separate from implementation; class state, registration, execution, lifecycle, React hooks and components have explicit modules.
- `src/components/settings/base` provides reusable settings shells, routing, navigation and discovery. Built-in content and its contribution belong together in `src/settings/sections/<section>`. Add each contribution to `settings/standard-settings.ts`; do not edit base components to add sections.
- Trusted extra settings contributions use the SettingsSection/AppPreferences contract. Register plugin pages under existing sections and retain cleanup handles. Storage definitions must also be registered on the server; UI registration alone grants no persistence access.

## Foundation-Entwicklungsleitfaden

Vor Änderungen an Foundation-Packages, Actions, Plugins, Integrationen oder Beispiel-Apps den projektspezifischen [Skill zur Foundation-Entwicklung](.agents/skills/foundation-development/SKILL.md) lesen. Er dokumentiert die vereinbarten Abläufe, UI-Anforderungen und Regressionen aus dem Review.

Bei Architektur- oder API-Änderungen und neuen bestätigten Integrationsfehlern den Foundation-Skill im selben Arbeitsschritt aktualisieren und veraltete Aussagen entfernen. Die Übereinstimmung mit dem implementierten Stand gehört zur Abschlussprüfung.

## Foundation package boundary

- `@bitakit/core` owns the framework-independent runtime and Actions. Core has no React dependency, React types, or UI renderer exports; React bindings belong to @bitakit/ui. Settings remains independently usable.
- Provider-specific adapters belong to optional packages, never Core. Register them as ordinary plugins, not a parallel integration system.
- Use shared typed service keys for plugin contracts; declare required services and preserve server/client separation.

## Minimal host application code

- Reuse the existing Foundation architecture and package APIs before adding host code. Keep application code limited to product behavior, native framework routes, and essential composition/configuration.
- Core already manages service registration, plugin lifecycle, and plugin-provided providers. The Better Auth adapter already registers the shared authentication service. Use these mechanisms; do not introduce a parallel registry, provider bootstrap, session store, or authentication binding in the app.
- Keep reusable provider-specific wiring in its optional adapter package, not Core or duplicated host files. Preserve server/client boundaries and explicit server configuration.
- Before adding host infrastructure, identify the concrete gap in existing package APIs. Moving boilerplate to another app folder is not simplification. Do not add wrappers or abstractions solely to reduce visible line count.
- Keep demo/catalog code separate from required application integration so it can be removed independently. Preserve native framework routing for app-owned pages.
- Write all new documentation, development guidance, and code comments in English, regardless of conversation language. Product localization catalogs are separate from this rule.

## Headless Core and generic UI bindings

- Core must remain usable on the backend without React or a UI library. Presentation payloads are opaque extension types; Core never renders them.
- packages/ui contains generic bindings and host-driven rendering only. Do not add shadcn, Radix, HeroUI, or copied visual components to this package.
- Apps and optional visual plugins own only their required UI components. Visual plugins never import app code or request a host component catalog. They consume generic action bindings from packages/ui and inherit the central application CSS theme tokens.
- Do not replace removed primitives with another central component-library package. Keep standard library components in the consuming app, and keep business execution/guards in Core.
