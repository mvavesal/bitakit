# Better Auth UI für SaaS Foundation

Ein schlankes, optionales Foundation-Plugin um die direkt importierbare externe
Bibliothek **`@better-auth-ui/heroui` (1.7.26)**. Keine Registry-Kopien, kein vendorter
Quellcode, keine nachgeschriebenen Formulare oder Package-Patches. Die Bibliothek
wird regulär über npm installiert. Die verworfenen shadcn-Experimente wurden entfernt.

## Install and register

```tsx
import { betterAuthUIPlugin } from '@bitakit/better-auth-ui';
import { organizationPlugin } from '@bitakit/better-auth-ui/plugins/organization';
import { multiSessionPlugin } from '@bitakit/better-auth-ui/plugins/multi-session';

const plugin = betterAuthUIPlugin({
  provider: {
    authClient, // the existing Better Auth client with matching client plugins
    queryClient, // TanStack QueryClient
    navigate: ({ to, replace }) => (replace ? router.replace(to) : router.push(to)),
    basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
    plugins: [organizationPlugin(), multiSessionPlugin()],
  },
});
// Add it to the existing Foundation configuration.
// The host router renders PluginPage for the registered paths.
```

Dependencies resolve through npm; React 19 is a peer dependency. Configure Better Auth on the
server, then pass the same auth client to the UI and to the optional `betterAuthPlugin`. The UI
plugin creates no second session and no second Foundation provider. Keep the QueryClient per
request on the server and stable in the browser. The host owns routing, the backend URL, mail and
OAuth configuration and the theme.

`provider` accepts the complete original `AuthProviderProps`: native plugins, locale, additional
fields, upload callbacks, social providers and every other option stay available. There is no
reduced copy of this API.

### `betterAuthUIPlugin(options)`

| Option            | Purpose                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `provider`        | Required. The complete native `AuthProviderProps`.                                                                                                                                                                       |
| `toastProvider`   | `false` omits the adapter's HeroUI `Toast.Provider` when the host already renders one (for example Shell). Default `true`.                                                                                               |
| `pages`           | `false` registers no auth, account or organization routes, for hosts that render the exported components with their own router.                                                                                          |
| `pageLayout`      | Optional host frame around the native account and organization pages.                                                                                                                                                    |
| `authPageLayout`  | Frame of the authentication pages, `pageLayout` otherwise. `createBetterAuthIntegration` uses `AuthPageLayout`, the package's sign-in frame with a way back to the application; "Add account" leads to the same sign-in. |
| `profileFallback` | Local demo content the account settings page shows as the profile while nobody is signed in. It is never treated as an authenticated account.                                                                            |

The plugin always contributes its account settings page; see
[Settings integration](#settings-integration). The former `accountSettings` and `settings`
(catalog registration) options are removed.

### `organizationUIPlugin(options)` from `@bitakit/better-auth-ui/organizations`

| Option   | Purpose                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `path`   | Path of the standalone management page, `/organizations` by default. `false` omits the page and its `organizations.open` action. |
| `groups` | Groups of the `organizations.open` navigation action; `['navigation']` by default.                                               |
| `demo`   | Marks the standalone page as a local demo with sample data.                                                                      |

The plugin always contributes its organization settings page. The former `settings`,
`settingsCategory` and `invitationsCategory` options and the plugin pages under `/settings/...`
are removed.

### Entry points

- The root entry re-exports every public main component of the library: Auth, SignIn, SignUp,
  SignOut, AuthRedirect, ForgotPassword, ResetLinkSent, ResetPassword, VerifyEmail, Settings,
  profile and security cards, UserAvatar, UserButton, UserView and more, plus
  `AccountSettingsPage`.
- `/plugins` re-exports every original extension and component; `/plugins/<name>` keeps the
  official subpaths (organization, multi-session, SSO, billing and so on).
- `/email` re-exports the original email templates.
- `/organizations` exports `organizationUIPlugin`, `OrganizationSettingsPage`, the organization
  views and `OrganizationSwitcher`.
- `betterAuthUIService` is the typed contract of the configuration (`services['better-auth-ui']`).

Details and exports: [CATALOG.md](CATALOG.md).

## Zentrales Theme

Im Tailwind-Host nach den Basisimports:

```css
@import '@heroui/styles';
@import '@better-auth-ui/heroui/styles';
@import '@bitakit/better-auth-ui/theme.css';
```

HeroUI liefert seine CSS-Komponenten aus der Abhängigkeit. Unsere externe CSS-Brücke
ordnet Farben, Rahmen, Karten-/Button-/Avatar-Radien und Squircle dem zentralen
Foundation-Theme zu. Der Host muss seine vorhandenen Foundation-Tokens/Utilities
bereitstellen. Kein neuer Farbwertsatz und keine Änderung in node_modules.
Die originalen Bibliotheksicons und Marken bleiben unverändert.

## Content Studio

Host-Konfiguration: `apps/content-demo/src/auth.tsx`.
Der reguläre Plugin-Beitrag liefert den Menülink **Konto & Organisationen**.

- `/better-auth`: öffentliche Paket-Einstiegspunkte.
- `/better-auth/auth/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`,
  `/verify-email`, `/accept-invitation` jeweils unter demselben Auth-Basispfad.
- `/better-auth/settings/account`, `/security`, `/organizations`.
- `/better-auth/organization/settings`, `/people`.
- Original UserButton, Organisation-Switcher und Mehrkonten-Auswahl.

`npm run dev:content-auth` startet den vorhandenen Web-Auth-Server auf3101 und lädt
ignorierte lokale SMTP-Daten. `npm run dev:content` startet den Host auf3102.
`FOUNDATION_AUTH_ORIGIN` steuert den Next-Rewrite für `/api/auth/*`.
`BETTER_AUTH_TRUSTED_ORIGINS` erlaubt die Host-Origin ausdrücklich;
`AUTH_UI_ORIGIN` bestimmt das Ziel der Einladung. Keine Secrets im Paket.

## Grenzen und Verantwortung

Im Host aktiv: E-Mail/Passwort, Organisation und MultiSession. Google/GitHub sind
auf ausdrücklichen Wunsch sichtbar, aber **ohne Credentials nicht eingerichtet**.
Sie sind kein Blocker für die lokale Integration und werden nicht extern getestet.

Alle öffentlichen Komponenten sind importierbar. Das aktiviert nicht automatisch
API Keys, MFA, SSO, Billing, Wallets oder Admin-Rechte. Diese verlangen passende
Better-Auth-Server-/Client-Plugins, Storage und gegebenenfalls externe Anbieter.
Kein eigener Nachbau dieser Funktionen im Foundation-Core.

Die nativen Organisationsabläufe sind die angebotenen Abläufe der externen Bibliothek,
nicht eine Behauptung vollständiger Parität zur historischen Foundation-Tabelle.
Bestehende Serverrechte und Sperr-Hooks bleiben erhalten. Das native Logo-Fallback
wird serverseitig auf begrenzte gültige PNG/JPEG/WebP-Daten geprüft; eigene Hosts
können die originale Upload-Option mit ihrem Storage verbinden.

SMTP-Zustellung ist eine Hostvoraussetzung und wird durch isolierte Tests nicht
bewiesen. Tests legen keine Konten in der geteilten Datenbank an und versenden keine
Mail. Produktionskonfiguration und zusätzliche native Plugins separat prüfen.

## Prüfen

```text
npm run build --workspace @bitakit/better-auth-ui
npm test --workspace @bitakit/better-auth-ui
npm run test:e2e --workspace @bitakit/content-demo -- better-auth-ui.spec.ts
```

Package-Tests prüfen Foundation-Lebenszyklus, native API-Weitergabe, Exporte und
isolierte echte Better-Auth-Abläufe. `tests/settings-pages.test.mjs` renders both settings pages
in jsdom against an isolated in-memory Better Auth handler and the demo organization backend. Browserprüfungen verwenden die echten importierten
Komponenten und einen isolierten echten Better-Auth-Handler statt erfundener Antworten.

Offizielle API und Lizenz bleiben bei der Abhängigkeit:
[HeroUI-Dokumentation](https://better-auth-ui.com/docs/heroui),
[Next.js-Integration](https://better-auth-ui.com/docs/heroui/integrations/nextjs).

### Content-Demo: Teams und API-Schlüssel

Der laufende Host aktiviert native Teams inklusive TeamSwitcher und die native
API-Key-Erweiterung. Teams: `/better-auth/organization/teams`. Persönliche Keys:
`/better-auth/settings/security`. Organisationskeys:
`/better-auth/organization/settings`. Es handelt sich um Verwaltung; keine
Domain-API wird allein dadurch automatisch für Key-Zugriff freigeschaltet.

Der Server verwendet `@better-auth/api-key` mit `default` (user) und
`organization` (organization). Organisationskeys bleiben rollen-/mitgliedschaftsgeprüft;
standardmäßig hat der Owner Zugriff. Die normale Sitzung wird nicht durch einen
API-Key ersetzt. Neue Team-Ersteller werden über die offizielle AddTeamMember-API
in ihr Team aufgenommen, damit native Team-Mitgliederverwaltung und Auswahl
sofort verfügbar sind. Bestehende Organisationen/Teams werden nicht pauschal migriert.

Migration `20260921010000_auth_teams_api_keys` ergänzt nur Auth-Felder und
servereigene Tabellen. RLS und entzogene öffentliche Tabellenrechte gelten auch
für Teams, Teammitglieder und API-Schlüssel. Keine generische CRUD-Exposition.
Die offene Entscheidung über den lokalen1.7.15-Kandidaten bleibt unverändert;
siehe RELEASE-CANDIDATE.md.

Native Styles werden über `@bitakit/better-auth-ui/styles.css` aus der installierten Bibliothek geladen; die Host-App benötigt keine zufällig gehoistete transitive Abhängigkeit. Danach ergänzt `theme.css` die zentralen Foundation-Werte. Native Select-Trigger verwenden die Select-Geometrie (rounded-md/Squircle), umrandete Dialog-Listenzeilen die Item-Geometrie (rounded-xl/Squircle).

### Paket-Styles

Der Styles-Einstieg registriert zusätzlich die eigenen ausgelieferten Klassen und lädt die notwendigen Core-Styles. Keine Monorepo-Scanpfade im Host erforderlich.

## Settings integration

Each plugin contributes exactly one settings section: an empty `defineSettings({}, section)`
declaration that carries the presentation, plus one settings page (`ui.settings`, the equivalent
of `ui/settings/page.tsx`). `useSettingsCatalog()` from `@bitakit/ui` derives the sections and
App Preferences renders each page under `/settings/<path>` inside its own frame. The pages
therefore render no page title, frame or navigation of their own; their parts start at heading
level 2. Nothing is registered at runtime, so there is nothing to clean up.

| Plugin             | Section      | Path                                       | Category, order    |
| ------------------ | ------------ | ------------------------------------------ | ------------------ |
| `better-auth-ui`   | Account      | `/settings/better-auth-ui` (the plugin ID) | `account`, 0       |
| `organizations-ui` | Organization | `/settings/organization`                   | `organization`, 10 |

- **Account** (`AccountSettingsPage`): the native profile (`UserProfile`), then security: email,
  password, linked accounts, two-factor authentication and active sessions, as the provider
  configuration enables them. While the session loads it shows "Checking sign-in…"; signed out it
  shows a sign-in link. With `profileFallback`, a signed-out visitor sees that content as the
  profile and the sign-in link under security. Account switching stays in the account menu; API
  keys remain available through the native package routes.
- **Organization** (`OrganizationSettingsPage`): tabs for the profile, members and sent
  invitations (offered only to members who can manage the active organization) and the
  invitations addressed to the viewer. The selected tab is URL state through nuqs:
  `?tab=profile|members|invitations`, where the default `profile` leaves the URL clean. The page
  needs the host's nuqs adapter and wraps its URL-backed part in `Suspense`. The URL action
  `organizations.settings` (Alt+Shift+O) opens it.

Sections cannot be hidden at runtime; role-dependent content is handled inside the page. Titles
and descriptions translate through `<plugin>.settings.title` and `<plugin>.settings.description`
(`better-auth-ui.settings.*` and `organizations-ui.settings.*` in this package's catalogs). Hosts
that render settings themselves can use the exported pages directly. The organization views
(`OrganizationSettings`, `OrganizationMembersSettings`, `OrganizationsPage`) accept `embedded`
to render inside a host frame: a level-2 heading and no page width of their own.

## Source ownership

Public exports are in src/index.ts; plugin composition is in src/plugin.tsx. Upstream re-exports live under src/upstream and preserve existing public import paths. Custom organization UI lives under src/components/organizations and is exposed through `/organizations`. See [Custom UI inventory](CUSTOM_COMPONENTS.md) for ownership, retained behavior, and migration limits.

The settings pages live in `src/settings`: `account.tsx` (`AccountSettingsPage`) and `organizations.tsx` (`OrganizationSettingsPage` and the organization views it embeds). Organization actions, including the `organizations.settings` URL action, live in `src/actions/organizations.ts`. Reusable custom controls stay under components.

## Minimal host composition

`createBetterAuthIntegration(options?)` creates one standard client, a QueryClient, and the existing authentication and UI plugins. Register its returned plugins through the ordinary Foundation config; Core owns provider installation and lifecycle. This helper is composition, not another registry or integration system.

Pass `organizations: { path: false, groups: [] }` to include the existing organization
service adapter and settings-only UI using that same client. Omitting `organizations`
retains the previous auth/UI-only composition. No server plugin, secret or database
configuration is changed by this client option. `src/integration.ts` owns this composition;
the organization service and UI retain their existing package ownership.

Host options are optional UI/provider customizations. The returned client is the same instance used by the shared auth service and UI; reuse it for organization adapters. A supplied client replaces client construction. Provider plugins explicitly replace the standard UI extension list, including an empty list. The standard native UI extensions match the standard browser client: organizations/teams, multi-session, API keys, and two-factor.

Relative redirectTo values resolve against the browser UI origin so a separate Auth server does not receive the post-login navigation. Hosts may supply their router's navigate function; the default uses browser navigation. Server routes, credentials, database adapters, and server extension activation remain explicit and server-only.

```ts
const authentication = createBetterAuthIntegration({
  provider: { redirectTo: '/contents', navigate },
  organizations: { path: false, groups: [] },
});
// Compose authentication.plugins in the existing Foundation provider.
```

Content Demo now keeps only its locale, paths, social providers, layout, and demo profile fallback in src/auth.tsx. It does not create the client, QueryClient, standard extensions, or auth/UI bindings itself.

## UI ownership

This visual package owns its required controls under src/components/ui and declares their library dependencies. It does not import application source or require host-components registration. Generic action execution bindings come from @bitakit/ui. The application supplies central CSS theme tokens; this package does not create another theme store.

For a minimal host, `organizationUIPlugin({ path: false })` contributes the organization settings page and commands without registering a standalone management page or its navigation Action. Omitting `path` preserves the existing default page.

### Shared notification surface

Our adapter's `toastProvider` option defaults to true, preserving standalone native behavior.
When Shell notifications own the shared HeroUI surface, set `toastProvider: false` on
`betterAuthUIPlugin` or `createBetterAuthIntegration`. This only omits our adapter's duplicate
`Toast.Provider`; the external Better Auth UI package and its notification calls are unchanged.
The shared default HeroUI queue lets Shell's position preference affect native notifications too.
A custom Foundation notification implementation does not redirect those native HeroUI calls;
retain a HeroUI surface separately when replacing the Foundation renderer.

### Shared translation catalog

The adapter reads the current `betterAuth` group from Foundation's translation service
and passes that group to the native `AuthProvider` locale prop. The group follows the
upstream `AuthLocale` format (`languageTag`, `localization`, optional `plugins`). Compose
published `@better-auth-ui/locales` bundles in the host's request catalog; custom messages
can be supplied through that same group. Explicit provider locale remains the fallback.
Language updates reuse the provider and client. Upstream implementation code stays untouched.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.
