# Review

Open review requirements are added at the top of this file as dated sections. Durable rules
derived from reviews live in `.agents/skills/foundation-development/SKILL.md`; resolved
episodes are condensed into the history below.

## History (pre-0.2)

One line per resolved review item or confirmed regression. Behavior described here is
history; the current contract is `docs/target-api.md` and the skill.

### Actions, groups and forms (review 2026-10-02)

- Quick Search stays navigation-only: it lists visible URL actions and never runs non-URL actions; `results.actions` was removed and `runtime.ownerOf()` is private again.
- Forms do not require a dialog: a page form runs an ordinary action through `useAction`, a dialog is an optional host; `defineFormAction` stayed documented as the quick dialog form until 0.2 removed form actions from Core.
- Action groups are explained independently of UI: a group only groups; components (menu, navigation, search) decide presentation; the "Action groups" docs page is the reference.
- A group's title belongs to its ID: the runtime keeps the first title given regardless of registration order; `useGroupTitle` falls back to it.
- The Actions guide opens with one default path and keeps `description`/`tooltip`, `enabled`/`visible`/`pending` distinct; the complexity audit found `dependsOn`, `unavailable`, `replaces`, `conventions`, `initialState` used only in tests and `configPath` unused, which led to their removal in 0.2.
- Hover text in every binding resolves `title` prop, then `tooltip`, then `description`; a button resolves its snapshot with its own input.

### Discovery and lifecycle

- A discovered second action stayed invisible because a demo menu rendered three fixed IDs and the copy used another group and path: discovery, placement and routing are separate stages to check.
- Recursive discovery must watch directory creation and renames; an extension filter alone missed the first action in a new folder.
- Explicit host routes win over the plugin catch-all in Next; duplicate or invalid plugin paths are rejected before mount; a client fallback is not an HTTP 404.
- Hot reload recreates local demo services and resets their data; never present that as persistence.
- Turbopack resolved the generated absolute `.foundation/app.ts` alias as a server-relative import, which forced `--webpack` until 0.2 replaced the alias with real generated files.
- `additionalPlugins` replaced discovered plugins out of order once (settings.ui before shell.ui); entries now replace in place and only new IDs append.
- `foundation.plugin` package factories received the resolved root config path (`foundation.configuration`); Shell and App Preferences activated automatically while remaining direct dependencies.
- Service names: public names were global by bare filename, so two plugins with `services/store.ts` collided; 0.2 namespaces services as `<plugin>.<file>`.

### Settings and App Preferences

- `AppPreferences` is the single owner of confirmed values; sections only reference definitions; removing a section never deletes stored values.
- Renderer precedence (app field > owner plugin field > type+variant layers > built-in) is resolved by one service; unknown variants are configuration errors; owner and layer come from the runtime scope, never from caller strings.
- The initial render snapshot must match the mounted runtime (SSR, hydration, mount); `SettingsProvider` keeps the initial catalog snapshot only for hydration.
- Settings navigation and overview must include field-based sections, not only legacy groups; shared category parents are registered once and never removed by a plugin's cleanup.
- Nested mobile settings drawer: the dialog ignores Escape from the portaled drawer; wait for real focus in browser checks.
- `SettingSelect` did not forward `error` to its `as` component (gap recorded; fixed centrally later).
- `data-disabled={disabled}` serialized `false` and disabled hover on every option card: boolean `data-*` flags are `value || undefined`.
- Reicon Outline mixes pre-expanded fill paths and true stroke paths; do not pair icons from both families; the layout choice used Sidebar and Window2.
- Individual reset is owned by App Preferences (`resetControl`); Shell only places the bound part.

### Shell, navigation and notifications

- Shell owns appearance and layout preferences, standalone NotFound/Error/Loading/AccessDenied pages and the shared HeroUI notification queue exposed as `app.services.notifications`; the position preference uses native placements.
- Package stylesheets that import `@heroui/styles` restore the theme's dark custom variant right after the import; HeroUI's variant painted shadcn hit areas as squares in generated apps.
- Horizontal shell renders bound groups as NavigationMenu categories; user trigger is an avatar; settings search sits in the sidebar; no second app header.
- Sidebar identity triggers map HeroUI hover/pressed colors to sidebar tokens; the content header uses background tokens so an independent dark sidebar does not darken it.
- Quick Search imports its CSS from the plugin module; `sideEffects` metadata keeps it from being pruned.
- Translation: `useTranslation` observes runtime notification revisions, not translator identity; settings and navigation resolve `settings.sections.<id>` and `settings.categories.<id>` keys; action labels use the shared `<id>.title` path everywhere.

### Better Auth, Better Auth UI and organizations

- Better Auth UI is consumed unmodified from npm; the vendored shadcn experiment was discarded; upstream re-exports live flat under `src/upstream`.
- Theme bridge: destructive HeroUI buttons join the primary surface mapping; card dividers map to the solid border; small buttons use Vega sm; tooltip triggers keep button flex layout; menu leading icons normalize to size-4.
- With separate UI and auth origins, Better Auth UI redirect targets must be absolute UI-origin URLs; same-origin memory tests do not catch this.
- Google and GitHub login activate only with their env secrets; a visible button proves no provider configuration.
- `multipleAccountsPerProvider: false` hides a second Google link row; it is UI only.
- Account settings (`/settings/profile`, `/settings/security`) are composed from public components; HeroUI `Settings` ignored `hideNav`, so embedded content uses the domain components instead of CSS hiding.
- Organizations: headless contract and service in `organizations`, UI in `better-auth-ui`; row actions render through public groups in a shared dropdown; tables stay one shadcn table with container scrolling; invitation dialogs re-check the opening context.
- Adapter details: `getOrganization` instead of `getFullOrganization` for identity; dates normalized to ISO strings at the package boundary; session objects compared by identity fields, not object identity; capability checks at render time; website validation shared between form and server with tldts; role changes name the fixed target and confirm.
- Two-factor uses Better Auth `twoFactor` and the UI plugin unchanged; migrations protect the table with RLS; API keys are shown once and revoked after tests.
- Local Supabase: the session pooler answered parallel queries where direct connections hung; TLS and CA verification stay on.
- Mail: `npm run dev:content-auth` loads the ignored mail env; Ethereal intercepts messages; SMTP verify proves no delivery.

### Generator, adapters and docs

- `create-app` uses the official pinned `create-next-app` empty scaffold and the blank TanStack Start template, never overwrites, keeps partial output on failure and supports `--no-install`, `--dry-run`, `--sample`, `--plugin` and `--packages-dir`.
- TanStack Start stays experimental: nuqs excludes it from supported coverage; verified versions are recorded in the package README.
- Generated type imports omit unused contribution types so strict host `noUnusedLocals` stays on.
- The docs site (`apps/docs`, Fumadocs) targets application developers; contributor steps stay in the contributing guide; README diagrams are generated by `scripts/readme-diagrams.mjs`.
- Core 0.1.1 and thirteen packages at 0.1.0 were published on 2026-10-01 after archive, export and license checks; the npm organization `bitakit` was verified.
