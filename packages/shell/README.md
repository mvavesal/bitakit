# @bitakit/shell

Optional app shell plugin. `shellPlugin()` contributes the Shell preferences, its
settings pages and their renderers, and registers navigation through the existing Foundation
runtime. `AppShell` renders children, brand, account, header and the given action groups. No auth,
router or database dependency. Navigation inherits the root ActionProvider link and pathname;
the Next adapter supplies both automatically. Explicit props still override them.

`sidebar` and `navbar` share one content node. Switching layout only changes its arrangement, not
the React key or the content hierarchy. Colors and typography come from the host's theme tokens;
the plugin ships no theme of its own.

## Automatic setup

With `withFoundation`, install Shell and App Preferences as direct app dependencies. Their opt-in
metadata discovers both plugins; no manual Shell plugin/provider registration is needed. Keep
`FoundationProvider` at the root and place the visual shell in the native workspace layout:

```tsx
<AppShell>{children}</AppShell>
```

Brand, account and header slots remain optional. Native authentication/settings routes and CSS
imports stay with the host. Automatic discovery does not activate transitive dependencies.

Optional `src/configs/shell.ts`:

```ts
import { defineConfig } from '@bitakit/core';
import type { ShellOptions } from '@bitakit/shell';

export default defineConfig({
  defaults: {
    layout: 'sidebar',
    navigationGroups: ['navigation'],
    appearance: true,
  } satisfies ShellOptions,
});
```

`layout` sets the initial preference default per provider instance; saved user choices win.
The existing `shell.layout` and `shell.theme` storage keys remain unchanged. `navigationGroups`
selects the shell's navigation, while `groups` controls placement of its Settings action.
Shell resolves the existing preferences service, including a host-configured storage/identity
integration. The preferences package still owns persistence and activation. Without automatic
discovery, compose `appPreferencesPlugin(...)` followed by `shellPlugin(...)` explicitly.

## Preferences and settings pages

Shell requires `appPreferencesPlugin` from `@bitakit/app-preferences/foundation` in the same Foundation.
It contributes its settings declaratively:

- `settings`: `shellPreferences` with `shell.theme` and `shell.layout` (keys unchanged).
- `settings.sections`: the Appearance page (`appearance: true`, category "Appearance" unless the host
  passes `category`) or the App Shell page, and the plugin overview with `pluginManagement: true`.
- `settings.renderers`: plugin-layer icon card renderers for its own fields and the Appearance
  section layout (one card per field).

With `pluginManagement: true`, Shell's setup also publishes one link per plugin to its view in the
overview (`/settings/plugins?plugin=<id>`), named from the plugin's metadata. Quick Search shows them
as plugin results when its `results.plugins` switch is on. The links follow the overview page's
visibility and are removed with Shell.

```tsx
const plugins = useMemo(
  () => [
    appPreferencesPlugin({ settings }),
    shellPlugin({ appearance: true, pluginManagement: true, category: accountCategory, groups: [] }),
  ],
  [settings],
);
```

The app can replace a Shell control with an app-layer field renderer (for example a file in
`src/renderers/`); Shell renderers never apply to other modules' fields. The DOM theme projection
(`dark` class, `color-scheme`, OS preference changes) runs in `setup` and follows the confirmed value.

A host can supply its own compatible theme definition with `theme: existingTheme` and leave DOM
projection to its existing adapter with `applyTheme: false`; Shell then co-owns that definition and
does not register `shell.theme`. `settingsPath` sets the page path. The legacy `settingsSection`
option places the Shell page under an existing host section; shared parents are registered and
removed only by the host.

`@bitakit/shell/definitions` exports `shellPreferences`, `shellTheme` and `shellLayout`
without React. Hosts with server persistence register these definitions on their trusted server
as well; client registration never grants persistence access.

## Settings frame

`SettingsShell` provides the settings layout with its own sidebar, breadcrumb and explicit back
destination; `SettingsPage` renders a catalog section with `PageHeader` and `SettingsSectionView`
after checking visibility and availability. `SettingsOverview` provides the search field and entry
list. All read the existing settings catalog instead of a second page list, and titles resolve
through the settings translator. `@bitakit/shell/settings` exports `SettingsShell`,
`SettingsNavigation` and `SettingsPage` without installing the app shell plugin; Web uses the same
frame directly and with `embedded` in its intercepted dialog. The host supplies path, link
component, translated `labels` and `backHref`. The UI check does not replace server authorization.
Search keeps the nuqs `q` parameter.

Predefined theme and navigation fields live in `src/settings/appearance.ts`. Both request the
built-in `cards` presentation from App Preferences. `src/settings/renderers.tsx` registers the
Shell-specific icon enrichment through the existing renderer service, using the shared
`CardsControl` from App Preferences. It does not duplicate card markup or interaction logic.
The public React-free `./definitions` entry remains stable, as do the persisted field keys.
`settingsCategories` exports the default categories.

## Package styles

In a Tailwind 4 host, `@import '@bitakit/shell/styles.css';`. The entry registers the
package's shipped classes and transitively the required UI, Core and Settings styles; it does not
define a second theme. Headless service use needs no CSS import.

## UI ownership

This visual package owns its required controls under `src/components/ui` and declares their
library dependencies. It does not import application source or require host component
registration. Generic action bindings come from `@bitakit/ui`; preference rendering goes
through the Settings renderer service. The application supplies the central CSS theme tokens.

## Theme preferences

With appearance integration enabled, Shell contributes `/settings/theme` through the same
Settings catalog as the appearance page. `src/settings/theme.ts` defines stable user keys for
primary color, corners and surface finish; `themePreferences` is also exported by `./definitions`.
The primary renderer uses standard radio fields and a native color input. Corners and surface
reuse the built-in App Preferences choice-card renderer.

`src/theme/projection.ts` subscribes to confirmed values, projects them onto the document root,
and restores host tokens on disposal. Failed or pending writes do not change the confirmed theme.
Color.js selects black or white foreground text for a custom primary fill; this does not certify
contrast for every use of that color, such as text links. `applyTheme: false` disables DOM projection.
The host central stylesheet (`apps/theme.css` in the examples) implements corner and finish tokens.
No second preference store is introduced. Font selection, logo branding and per-field developer
visibility switches remain deferred.

Catalog navigation includes sections containing fields, legacy groups or custom components.
The sidebar and mobile drawer use this same projection, including the Theme page.

## Source organization

- Root entry points: `index.ts`, `settings.ts` and `definitions.ts` preserve public imports.
- `plugin.tsx`: plugin composition and contributions.
- `settings/`: predefined fields, categories, renderers, page, overview, navigation frame and link context.
- `components/`: application shell and required UI primitives. Shared Button and action-menu presentation come from the UI package.
- `services/`: typed Shell service contract.
- `theme/`: confirmed-preference DOM projection.

Catalog projection is imported directly from App Preferences; no forwarding module is needed.

## Replace the two standard layouts

`AppShell` accepts `layouts`, a partial mapping of the existing `sidebar` and `navbar` values.
Each `ShellLayout` has a `Navigation` component and an optional `Header` above the content area.
Both receive `ShellLayoutProps`: brand, account, header content, Action groups, pathname and link
component. Omitted variants use `verticalLayout` or `horizontalLayout`. Define replacement
components outside render to keep component identity stable.

The shell owns the content subtree; overrides change its surrounding navigation/header only.
Switching variants retains mounted page state. Selection remains in the existing `shell.layout`
preference, with two fixed choices. There is no new layout registry, discovery or selection store.

`@bitakit/ui/components` exports the standard sidebar/navigation primitives, `AppBar`
(left, center, right and bottom ReactNode slots), `ActionSidebarNavigation` and
`ActionNavigationMenu`. The navigation components reuse the existing root Action bindings;
URL Actions remain links and command Actions remain buttons. Shell's public `./sidebar` entry
is retained for compatibility. See [examples/composition.tsx](examples/composition.tsx) for a complete
composition; it is type-checked with the package tests.


AppearanceSection places App Preferences' pre-bound `item.resetControl` in each settings card.
The Settings package owns the reset operation, pending/error state and standard button; Shell
only composes that existing part. This does not add section-wide reset or affect auth forms.


### Notifications for developers

Enable `shellPlugin({ notifications: true })` (or the same option in the discovered Shell config).
HeroUI is the default renderer. The existing public service facade exposes:

```tsx
const app = useFoundationApp();
const id = app.services.notifications.show('Saved', { type: 'success' });
app.services.notifications.dismiss(id);
```

Commands can use the same `app.services.notifications` from their execution context. Plugins use
`notificationService` with `getService` and declare the existing service requirement. Before mount
or when disabled, check `app.optional.services.notifications`. No global service object is created.

`show` accepts `type` (`info`, `success`, `warning`, `error`), optional plain-text `description` and
`duration` in milliseconds (zero stays open). It returns the native notification ID. Callers never
import HeroUI. Explicit Action outcome feedback forwards to this same service automatically.

The Notifications page persists one position via App Preferences. `notifications: { placement:
  'top end' }` configures its default; saved values win,
and the individual reset returns to that configured default. Supported positions are `top`,
`top start`, `top end`, `bottom`, `bottom start`, `bottom end`; start/end follow writing direction.

For Better Auth UI, configure our adapter with `toastProvider: false` so Shell is the only native
surface. HeroUI's public default queue receives both our service calls and native Better Auth calls,
so position changes apply to both. Do not pass a second FoundationProvider notify callback. This
queue is browser-wide, not isolated per Foundation runtime. Shell disposal removes its notifier
and invalidates its retained service; it does not clear unrelated native notifications.

To replace the implementation, use the existing service factory/lifecycle contract and mount the
chosen vendor's provider in your application or an ordinary plugin provider:

```tsx
shellPlugin({
  notifications: {
    toastProvider: false,
    service: {
      create: () => ({
        show(message, options) {
          const method = options?.type ?? 'info';
          return toast[method](message, {
            description: options?.description,
            duration: options?.duration,
          });
        },
        dismiss(id) { toast.dismiss(id); },
      }),
    },
  },
});
```

This example assumes your application imports Sonner's `toast` and mounts its `Toaster`.
`requires` and `dispose` remain available on the service definition. Custom-provider mode omits the
native HeroUI position page. Better Auth's own calls remain HeroUI: keep a native surface for them
(e.g. our adapter's default surface). Replacing Foundation's service does not intercept upstream.

Ownership: `services/notifications.ts` defines the vendor-independent public contract;
`services/heroui-notifications.ts` adapts the native queue; `providers/notifications.tsx` owns the
single surface and runtime notifier cleanup; `settings/notifications.ts` declares persistence.

### Shared notification layout

Configure `notifications.layout` once on `shellPlugin` (or in the discovered Shell config).
It uses HeroUI's native provider children renderer, not a separate layout registry:

```tsx
import { Toast } from '@heroui/react';

shellPlugin({
  notifications: {
    layout: ({ toast }) => (
      <Toast toast={toast} variant={toast.content.variant}>
        <Toast.Content>
          <Toast.Title>{toast.content.title}</Toast.Title>
          <Toast.Description>{toast.content.description}</Toast.Description>
        </Toast.Content>
        {toast.content.actionProps && <Toast.ActionButton {...toast.content.actionProps} />}
        <Toast.CloseButton />
      </Toast>
    ),
  },
});
```

Calls to `app.services.notifications.show` stay unchanged. This renderer also receives
native Better Auth notifications in the shared HeroUI queue; upstream code is unchanged.
Use the native Toast parts for accessible titles, descriptions, actions and dismissal.
Custom renderers own which content they preserve, including indicators and loading states.
Omit `layout` to retain HeroUI's default renderer. With `toastProvider: false`, the
app-owned surface controls rendering and this option has no effect. This is initialization
configuration, not a runtime `setLayout` or per-message custom-content API.

Notification titles and descriptions accept translation keys, resolved centrally through the Foundation i18n service when shown. Pass interpolation data with `options.values`. Missing keys retain their literal text. This also applies to configured replacement services; already displayed messages are not retranslated.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.

## Standalone page states

`@bitakit/shell/pages` exports `NotFoundPage`, `ErrorPage`, `LoadingPage` and
`AccessDeniedPage`. They compose the existing Empty and Button components, inherit the
central theme, and work without a sidebar, AppShell or ShellProvider. Include the normal
Shell/theme CSS in the host. Optional `title`, `description` and `children` customize
content; `ErrorPage` accepts `reset` for the standard retry button. Raw errors are not shown.
The Shell DE/EN catalogs supply defaults when the translation service is available;
standalone rendering uses English fallbacks.

For example, a Next.js host keeps native route ownership:

```tsx
// app/not-found.tsx
export { NotFoundPage as default } from '@bitakit/shell/pages';
```

```tsx
// app/error.tsx
'use client';
import { ErrorPage } from '@bitakit/shell/pages';
export default function Error({ reset }: { reset: () => void }) {
  return <ErrorPage reset={reset} />;
}
```

Use `LoadingPage` in the native loading route or Suspense fallback. A global error route
still supplies its own required HTML/body wrapper. These components do not set HTTP status,
create routes, redirect or authorize requests. Host-owned links can be passed as children.
