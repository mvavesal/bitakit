# Better Auth UI for BitaKit

A thin optional adapter for **`@better-auth-ui/heroui` (1.7.15)**, installed from npm
and consumed through its public exports. Native forms and behavior remain upstream;
the adapter supplies BitaKit contracts, settings integration and the shared theme bridge.

## Install and register

The package manifest declares
`bitakit: { plugin: './plugin', configuration: 'better-auth-ui', dependencies: ['better-auth'] }`,
so a generated app composes the plugin (and `@bitakit/better-auth`, which it depends on) without
host code. The plugin takes no host objects. The Better Auth client arrives through the
`betterAuthClient` contract of `@bitakit/better-auth` (see its README: one file,
`src/services/better-auth-client.ts`); the options live in `src/configs/better-auth-ui.ts`:

```ts
// src/configs/better-auth-ui.ts
import { defineConfig } from '@bitakit/core';

export default defineConfig({
  defaults: {
    toastProvider: false, // Shell renders the HeroUI toast region
    provider: {
      basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
    },
  },
});
```

`defineConfig` holds plain immutable data. Do not put a `QueryClient`, React components,
native plugin objects or callbacks in it. For native options containing those values, use
the existing `createBetterAuthIntegration` client composition and pass its plugins as
`additionalPlugins` to the generated `BitaKitProvider`. This keeps one runtime and one native
auth client. Explicit client composition supplies native options; package discovery still
owns CSS integration. Public auth pages must remain mounted while the native session
revalidates on window focus; place them outside a protected application's pending screen.

The manifest exports `./package.json` and declares component CSS and the theme bridge.
Generated hosts receive both through `bitakit.gen.css`; no individual HeroUI component
imports or app-specific theme patches are needed.

Dependencies resolve through npm; React 19 is a peer dependency. Configure Better Auth on the
server and provide the same client the `auth` service uses. The UI plugin creates no second
session and no second BitaKit provider. The host owns routing, the backend URL, mail and
OAuth configuration and the theme.

`provider` accepts the original `AuthProviderProps` except `authClient`: native plugins,
locale, additional fields, upload callbacks, social providers, `queryClient`, `navigate` and
every other option stay available. There is no reduced copy of this API. The configuration
service (`betterAuthUIService`) adds the client from the contract. Services exist once the
runtime is ready; until then the native `AuthProvider` renders with the configured options and
without a client, so the tree keeps its shape. Plugin pages and slots render only after
readiness; render native Better Auth UI components there, not in host routes that render before.

### `betterAuthUIPlugin(options)`

| Option            | Purpose                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `provider`        | Native `AuthProviderProps` without `authClient`, from `configs/better-auth-ui.ts`.                                                                                                                                       |
| `toastProvider`   | From `configs/better-auth-ui.ts`. `false` omits the adapter's HeroUI `Toast.Provider` when the host already renders one (for example Shell). Default `true`.                                                             |
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

## Central theme

Discovery collects this package's declared component styles and theme bridge into
`bitakit.gen.css`. Generated hosts establish `theme, base, components, utilities` before
importing Tailwind and the generated entry. Do not add separate JavaScript CSS imports
or copy individual component styles into the app.

HeroUI supplies the component CSS. `theme.css` maps colors, borders, surface geometry
and squircle behavior to the existing central BitaKit tokens. The bridge does not modify
upstream packages or create another palette. A host outside Discovery must provide the
same root layer order, baseline tokens and declared stylesheet entries explicitly.

## Content Studio

Host configuration: `apps/content-demo/src/auth.tsx`.
The regular plugin contribution supplies the **Account & Organizations** menu link.

- `/better-auth`: public package entry points.
- `/better-auth/auth/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`,
  `/verify-email`, `/accept-invitation`, each under the same auth base path.
- `/better-auth/settings/account`, `/security`, `/organizations`.
- `/better-auth/organization/settings`, `/people`.
- Original UserButton, organization switcher and multi-account selection.

`npm run dev:content-auth` starts the existing web auth server on port 3101 and loads
the ignored local SMTP data. `npm run dev:content` starts the host on port 3102.
`FOUNDATION_AUTH_ORIGIN` controls the Next rewrite for `/api/auth/*`.
`BETTER_AUTH_TRUSTED_ORIGINS` explicitly allows the host origin;
`AUTH_UI_ORIGIN` sets the invitation target. The package contains no secrets.

## Limits and responsibilities

Active in the host: email/password, organizations and MultiSession. Google/GitHub are
visible on explicit request, but **not set up, because no credentials are configured**.
They do not block the local integration and are not tested externally.

All public components can be imported. That does not automatically enable
API keys, MFA, SSO, billing, wallets or admin rights. These require matching
Better Auth server/client plugins, storage and, where needed, external providers.
BitaKit Core does not reimplement these features.

The native organization flows are the flows the external library offers; they are
not a claim of full parity with the organization features of the earlier custom implementation.
Existing server permissions and suspension hooks remain in place. The server checks the
native logo fallback for size-limited, valid PNG/JPEG/WebP data; custom hosts
can connect the original upload option to their own storage.

SMTP delivery is a host requirement and is not proven by isolated tests. Tests
create no accounts in the shared database and send no mail. Check the
production configuration and any additional native plugins separately.

## Verification

```text
npm run build --workspace @bitakit/better-auth-ui
npm test --workspace @bitakit/better-auth-ui
npm run test:e2e --workspace @bitakit/content-demo -- better-auth-ui.spec.ts
```

Package tests check the BitaKit lifecycle, native API pass-through, exports and isolated
real Better Auth flows. `tests/settings-pages.test.mjs` renders both settings pages in jsdom
against an isolated in-memory Better Auth handler and the demo organization backend. Browser
checks use the real imported components and an isolated real Better Auth handler instead of
invented responses.

The official API and license remain with the dependency:
[HeroUI documentation](https://better-auth-ui.com/docs/heroui),
[Next.js integration](https://better-auth-ui.com/docs/heroui/integrations/nextjs).

### Content Demo: teams and API keys

The running host enables native teams, including TeamSwitcher, and the native
API key extension. Teams: `/better-auth/organization/teams`. Personal keys:
`/better-auth/settings/security`. Organization keys:
`/better-auth/organization/settings`. This is management only; it does not by itself
make any domain API accessible with a key.

The server uses `@better-auth/api-key` with `default` (user) and
`organization` (organization). Organization keys remain subject to role and membership
checks; by default the owner has access. An API key does not replace the normal
session. New team creators are added to their team through the official AddTeamMember API,
so native team member management and selection are available immediately.
Existing organizations and teams are not migrated wholesale.

Migration `20260921010000_auth_teams_api_keys` adds only auth fields and
server-owned tables. RLS and revoked public table privileges also apply
to teams, team members and API keys. There is no generic CRUD exposure.
The open decision about the local 1.7.15 candidate remains unchanged.

Native styles are loaded from the installed library through `@bitakit/better-auth-ui/styles.css`; the host app needs no transitive dependency that happens to be hoisted. `theme.css` then adds the central BitaKit values. Native Select triggers use the Select geometry (rounded-md/Squircle); bordered dialog list rows use the Item geometry (rounded-xl/Squircle).

### Package styles

The styles entry also registers the package's own shipped classes and loads the required Core styles. The host needs no monorepo scan paths.

## Settings integration

Account Profile (`/settings/account`) and Security (`/settings/account/security`) are separate
pages in the shared settings catalog. `AccountProfileSettings` and `AccountSecuritySettings`
are independently composable; `AccountSettingsPage` retains their combined composition.
Security uses the native provider-configured cards and the existing sign-in guards.
Organization profile is `/settings/organization`; members and sent invitations are
`/settings/organization/members`. Personal incoming invitations are `/settings/account/invitations`,
under Account, independent of the selected organization. Old `?tab=` links no longer select
these pages; update bookmarks to their dedicated paths. Members still use URL-backed filters
and their existing pending-invitations tab. The host owns each page heading.

`OrganizationSettings`, `OrganizationMembersSettings`, `OrganizationsPage` and the exported
`IncomingInvitations` remain usable independently. `embedded` omits the page heading and width
while retaining toolbars and content. The settings wrappers wait for runtime readiness and
management content remains guarded for direct URL access; navigation is not authorization.

The organization form uses one standard Card for appearance and general fields, with its
shared save button inside the card at the logical end. Organization deletion has its own
standard Card below the save form, with irreversible-action
copy and a standard destructive button. It is visible only when deletion is permitted, uses
the existing confirmation action, and does not alter deletion semantics or server authorization.
Additional page labels use `<plugin>.settings.pages.<id>.title` and `.description`.

## Source ownership

Public exports are in src/index.ts; plugin composition is in src/plugin.tsx, whose default export is the package plugin entry (`./plugin`). Upstream re-exports live under src/upstream and preserve existing public import paths. Custom organization UI lives under src/components/organizations and is exposed through `/organizations`. See [Custom UI inventory](CUSTOM_COMPONENTS.md) for ownership, retained behavior, and migration limits.

The settings pages live in `src/settings`: `account.tsx` (`AccountSettingsPage`) and `organizations.tsx` (`OrganizationSettingsPage` and the organization views it embeds). Organization actions, including the `organizations.settings` URL action, live in `src/actions/organizations.ts`. Reusable custom controls stay under components.

## Minimal host composition

`createBetterAuthIntegration(options?)` is the manual composition for hosts without a generated configuration. It creates one standard client, a QueryClient, and the existing authentication and UI plugins, plus a `better-auth-client` plugin that provides the client (and, with `organizations`, the organization backend) through their contracts. Register its returned plugins through the ordinary BitaKit config; Core owns provider installation and lifecycle. Generated hosts use the service and config files above instead.

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
// Compose authentication.plugins in the existing BitaKit provider.
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
A custom BitaKit notification implementation does not redirect those native HeroUI calls;
retain a HeroUI surface separately when replacing the BitaKit renderer.

### Shared translation catalog

The adapter reads the current `betterAuth` group from BitaKit's translation service
and passes that group to the native `AuthProvider` locale prop. The group follows the
upstream `AuthLocale` format (`languageTag`, `localization`, optional `plugins`). Compose
published `@better-auth-ui/locales` bundles in the host's request catalog; custom messages
can be supplied through that same group. Explicit provider locale remains the fallback.
Language updates reuse the provider and client. Upstream implementation code stays untouched.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.

Settings card actions align at the logical end (right in LTR) through the shipped theme
bridge and shared organization components. Native form submit controls and HeroUI's public
fieldset action slot are targeted; input adornments and sign-in forms are not repositioned.
New hosts using the standard discovered styles need no application CSS for this behavior.

### Invitation states

Incoming invitations use the standard shadcn Empty composition from the owning visual package,
with theme-inherited icon, title and description. Loading, unavailable provider, provider error,
no pending invitations and no search results retain distinct messages. `IncomingInvitations`
accepts `emptyState` to replace the no-invitations presentation; it does not replace access
errors or loading states. Authentication and email verification remain provider-owned.

Organization member menus read the typed `organizations.member.menu` Action slot. Contributors use `slots: [{ slot: 'organizations.member.menu', input: ({ payload }) => payload }]`; each row supplies `{ organizationId, memberId }`. Logical member-group membership alone no longer places an Action in that menu. Native Action bindings retain guards, confirmation and keyboard behavior. Other organization toolbars retain their current group queries.

The optional standalone Organizations entry uses `organizationUIPlugin({ slots: ['host.navigation'] })`; default placement joins Shell when present, and `slots: []` omits it. This does not affect the owned member-menu slot.


Settings declarations include page boundaries shared with slot extensions. Account pages keep
pending/sign-in behavior (and the optional local profile fallback); organization management
checks `canManage`; invitation loading/provider verification failures retain their existing
fallback. App Preferences encloses the full page, toolbar and extensions in that same boundary.
Native standalone components retain their own guards. No provider/server access policy changes.

Organization toolbar, organization selection, management/danger, members and incoming/outgoing
invitation renderers now consume explicit `organizations.*` slots. Their owner context is
`{ organizationId }`, with `invitationId` for invitation entries; the member menu additionally
uses `memberId`. Existing groups remain logical queries. Bind mapped `item.action` controls
through the existing Action renderer; do not copy input or presentation state.
