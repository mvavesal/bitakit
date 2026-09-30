# Better Auth UI für SaaS Foundation

Ein schlankes, optionales Foundation-Plugin um die direkt importierbare externe
Bibliothek **`@better-auth-ui/heroui` (1.7.26)**. Keine Registry-Kopien, kein vendorter
Quellcode, keine nachgeschriebenen Formulare oder Package-Patches. Die Bibliothek
wird regulär über npm installiert. Die verworfenen shadcn-Experimente wurden entfernt.

## Installieren und registrieren

```tsx
import { betterAuthUIPlugin } from '@bitakit/better-auth-ui';
import { organizationPlugin } from '@bitakit/better-auth-ui/plugins/organization';
import { multiSessionPlugin } from '@bitakit/better-auth-ui/plugins/multi-session';

const plugin = betterAuthUIPlugin({
  provider: {
    authClient, // bestehender Better-Auth-Client mit passenden Client-Plugins
    queryClient, // TanStack QueryClient
    navigate: ({ to, replace }) => replace ? router.replace(to) : router.push(to),
    basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
    plugins: [organizationPlugin(), multiSessionPlugin()],
  },
});
// In die bestehende Foundation-Konfiguration aufnehmen.
// Der Host-Router rendert PluginPage für die registrierten Pfade.
```

Die Abhängigkeiten werden über npm aufgelöst; React19 ist eine Peer-Abhängigkeit.
Serverseitig Better Auth konfigurieren, dann denselben Auth-Client an UI und optionalen
`betterAuthPlugin` übergeben. Das UI-Plugin erzeugt keine zweite Sitzung und keinen
zweiten Foundation-Provider. QueryClient serverseitig pro Request, im Browser stabil
halten. Der Host besitzt Routing, Backend-URL, Mail-/OAuth-Konfiguration und Theme.

`provider` akzeptiert die vollständigen originalen `AuthProviderProps`: native
Plugins, Locale, zusätzliche Felder, Upload-Callbacks, Social Providers und weitere
Optionen bleiben zugänglich. Es gibt keine reduzierte Kopie dieser API.

- Root exportiert alle öffentlichen Hauptkomponenten direkt weiter: Auth, SignIn,
  SignUp, SignOut, AuthRedirect, ForgotPassword, ResetLinkSent, ResetPassword,
  VerifyEmail, Settings, Profil/Sicherheit, UserAvatar, UserButton, UserView usw.
- `/plugins` exportiert alle originalen Erweiterungen/Komponenten; `/plugins/<name>`
  erhält die offiziellen Unterpfade (Organisation, MultiSession, SSO, Billing usw.).
- `/email` exportiert die originalen Mailvorlagen.
- `pages: false` erlaubt eigene Host-Seiten statt automatischer Auth-/Settings-/Org-Routen.
- `pageLayout` liefert den optionalen Host-Rahmen.
- `betterAuthUIService` ist der typisierte Foundation-Service für die Konfiguration.
- `settings: { catalog, section, entries: [{ id, title, view }] }` registriert auf
  Wunsch vorhandene native Ansichten im bestehenden Settings-Katalog. Cleanup
  entfernt die Beiträge. Keine parallele doppelte Organisationsverwaltung registrieren.

Details und Exporte: [CATALOG.md](CATALOG.md).

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

Host-Konfiguration: `apps/content-demo/src/features/better-auth/plugin.tsx`.
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
isolierte echte Better-Auth-Abläufe. Browserprüfungen verwenden die echten importierten
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

### Plugin-eigene Kontoeinstellungen

`accountSettings: { catalog }` aktiviert Profil und Sicherheit im Settings-Katalog. Das Plugin besitzt Inhalte, Icons, Kategorienzuordnung und Cleanup. Profil zeigt persönliche Angaben; Sicherheit enthält E-Mail, Passwort, verknüpfte Konten und Sitzungen. Kontenwechsel bleibt im Kontomenü, API keys remain available through native package routes; the Content Demo component showcase has been removed. Optional: `category` und `profileFallback` für einen ausdrücklich lokalen Demo-Einstieg. Die App benötigt keine eigenen Settings-Seiten.

`authPageLayout: AuthPageLayout` verwendet den paket-eigenen Anmelderahmen mit Rückkehr zur Anwendung. `pageLayout` wraps native account and organization content; Content Demo uses its existing workspace shell. Auch „Konto hinzufügen“ führt damit zur regulären Anmeldung.

## Source ownership

Public exports are in src/index.ts; plugin composition is in src/plugin.tsx. Upstream re-exports live under src/upstream and preserve existing public import paths. Custom organization UI lives under src/components/organizations and is exposed through `/organizations`. See [Custom UI inventory](CUSTOM_COMPONENTS.md) for ownership, retained behavior, and migration limits.

Organization settings components and catalog registration live in `src/settings/organizations.tsx`; account settings live in `src/settings/account.tsx`. Reusable custom controls stay under components.

## Minimal host composition

`createBetterAuthIntegration(options?)` creates one standard client, a QueryClient, and the existing authentication and UI plugins. Register its returned plugins through the ordinary Foundation config; Core owns provider installation and lifecycle. This helper is composition, not another registry or integration system.

Pass `organizations: { path: false, groups: [] }` to include the existing organization
service adapter and settings-only UI using that same client. The organization catalog
defaults to `accountSettings.catalog` and may be overridden. Omitting `organizations`
retains the previous auth/UI-only composition. No server plugin, secret or database
configuration is changed by this client option. `src/integration.ts` owns this composition;
the organization service and UI retain their existing package ownership.

Host options are optional UI/provider customizations. The returned client is the same instance used by the shared auth service and UI; reuse it for organization adapters. A supplied client replaces client construction. Provider plugins explicitly replace the standard UI extension list, including an empty list. Account settings remain an explicit catalog integration. The standard native UI extensions match the standard browser client: organizations/teams, multi-session, API keys, and two-factor.

Relative redirectTo values resolve against the browser UI origin so a separate Auth server does not receive the post-login navigation. Hosts may supply their router's navigate function; the default uses browser navigation. Server routes, credentials, database adapters, and server extension activation remain explicit and server-only.

```ts
const authentication = createBetterAuthIntegration({
  provider: { redirectTo: '/contents', navigate },
  accountSettings: { catalog: settings },
});
// Compose authentication.plugins in the existing Foundation provider.
```

Content Demo now keeps only its locale, paths, social providers, layout, and demo profile fallback in src/auth.tsx. It does not create the client, QueryClient, standard extensions, or auth/UI bindings itself.

## UI ownership

This visual package owns its required controls under src/components/ui and declares their library dependencies. It does not import application source or require host-components registration. Generic action execution bindings come from @bitakit/ui. The application supplies central CSS theme tokens; this package does not create another theme store.

For a minimal host, `organizationUIPlugin({ path: false, settings })` contributes organization Settings and commands without registering a standalone management page or its navigation Action. Omitting `path` preserves the existing default page.


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
