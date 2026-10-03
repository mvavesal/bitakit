# @bitakit/shell

The application frame for BitaKit apps: sidebar and navbar layouts that render navigation
actions and plugin slots, page layouts, appearance settings projected onto the document, the
pre-paint theme script, standalone page states and the shared notification surface.

Shell owns no settings UI. It declares its settings with `defineSettings`; a settings UI such
as `@bitakit/app-preferences` renders them. Navigation, slots and settings come from the
`@bitakit/ui` hooks, and every visual part is built from the central components in
`@bitakit/ui/components` with the host's theme tokens.

## Setup

Add `@bitakit/shell` to the app dependencies. Discovery installs `shellPlugin`, imports
`styles.css` through `bitakit.gen.css` and adds the declared slots to `SlotMap`. Place the
frame in the app layout and the theme script in the root layout:

```tsx
// src/app/layout.tsx
import type { ReactNode } from 'react';
import { ShellThemeScript } from '@bitakit/shell';
import { BitaKitProvider } from '../bitakit.gen';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ShellThemeScript />
      </head>
      <body>
        <BitaKitProvider>{children}</BitaKitProvider>
      </body>
    </html>
  );
}

// src/app/(app)/layout.tsx
import { AppShell } from '@bitakit/shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

Load `@bitakit/shell/locales/<lang>.json` with the other package catalogs. Without discovery,
add `shellPlugin(options)` to the plugins of `FoundationProvider` yourself.

## Options

Options live in `src/configs/shell.ts`, which discovery passes to the factory:

```ts
import { defineConfig } from '@bitakit/core';
import type { ShellOptions } from '@bitakit/shell';

export default defineConfig({
  defaults: {
    groups: ['navigation', 'admin'],
    presets: [{ id: 'ocean', label: 'Ocean' }],
  } satisfies ShellOptions,
});
```

| Option    | Default          | Meaning                                                                      |
| --------- | ---------------- | ---------------------------------------------------------------------------- |
| `groups`  | `['navigation']` | Action groups the frame renders as navigation, in order                      |
| `presets` | none             | Theme presets offered next to `default`; see [Theme presets](#theme-presets) |

`shellOptions` is the zod schema of these options (`defineConfig({ schema: shellOptions })`
works too). The factory validates its input and throws an error that names the invalid key;
options that no longer exist fail the same way.

## AppShell

`<AppShell>` renders the default frame in the layout the user chose (`shell.layout`):

- **Sidebar**: the vertical navigation with the `sidebar.header` and `sidebar.footer` slots, a
  drawer below 768 px. Above the page, the top bar with the sidebar trigger and `header`.
- **Navbar**: one bar with `brand` at the start, the navigation menu (entries wrap) and `account`
  at the end.

Both layouts keep the page at the same position in the tree, so switching does not remount it
or lose unsaved input. The top bar renders the `app-bar.end` slot in both layouts.

| Prop         | Meaning                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| `groups`     | Navigation action groups; defaults to the `groups` option                    |
| `brand`      | Sidebar header (sidebar layout) or start of the top bar (navbar layout)      |
| `account`    | Sidebar footer (sidebar layout) or end of the top bar (navbar layout)        |
| `header`     | Next to the sidebar trigger (sidebar layout), for example the page title     |
| `components` | `{ Sidebar?, TopBar?, Content?, NavigationItem? }` replacing parts wholesale |

Navigation entries are bound actions from `useNavigation(groups)`: actions with an `href`
render as links (the framework link for internal paths), the others as buttons. The entry
whose `href` matches the current pathname carries `aria-current="page"`.

### Page layouts

Plugin pages choose a layout with `export const layout = '<name>'`. `AppShell` reads it through
`useCurrentPage()`:

- `blank` renders the page without a frame.
- A name with a layout in `src/layouts/<name>.tsx` renders that layout instead of the frame. A
  layout may render its own `<AppShell>`, which then draws the frame.
- Pages without a layout use the default frame.

### Parts

`AppShell.Sidebar`, `AppShell.TopBar`, `AppShell.Content` and `AppShell.NavigationItem` are the
parts of the default frame. When the children of `<AppShell>` include a part, `AppShell`
renders the children as given instead of the default parts:

```tsx
<AppShell>
  <AppShell.Sidebar header={<AppLogo />} footer={<AccountMenu />} />
  <AppShell.Content topBar={<AppShell.TopBar header="Reports" />}>{children}</AppShell.Content>
</AppShell>
```

| Part                      | Props                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| `AppShell.Sidebar`        | `groups?`, `header?` (before the slot), `footer?` (after the slot)    |
| `AppShell.TopBar`         | `groups?`, `brand?`, `header?`, `end?` (after the `app-bar.end` slot) |
| `AppShell.Content`        | `topBar?` (above the page inside the content area), `children`        |
| `AppShell.NavigationItem` | `item` (bound action), `active`, `layout` (`'sidebar'` or `'navbar'`) |

Each part reads its data from the hooks, so it also works in a hand-written frame inside the
standard `SidebarProvider`. Parts and `components` overrides are client components; a layout
that customizes them is a `'use client'` file. Define the `components` map outside render.

### A layout from the hooks

The hooks give a layout everything the Shell renders, without any Shell part:

```tsx
'use client';
import { Action, useNavigation, useSlot, useSetting } from '@bitakit/ui';

export default function MinimalLayout({ children }: { children: ReactNode }) {
  const { groups, isActive } = useNavigation(['navigation']);
  const footer = useSlot('sidebar.footer');
  const layout = useSetting('shell.layout').value;
  return (
    <div data-layout={layout}>
      <nav aria-label="Main navigation">
        {groups
          .flatMap((group) => group.items)
          .map((item) => (
            <Action key={item.id} id={item}>
              {item.href === undefined ? (
                <button type="button" />
              ) : (
                <a aria-current={isActive(item.href) ? 'page' : undefined} />
              )}
            </Action>
          ))}
      </nav>
      <main>{children}</main>
      {footer.map(({ key, component: Contribution }) => (
        <Contribution key={key} />
      ))}
    </div>
  );
}
```

`examples/composition.tsx` shows a layout from the parts and one from the hooks.

## Slots

| Slot             | Rendered by                                  |
| ---------------- | -------------------------------------------- |
| `app-bar.end`    | The top bar in both layouts (`AppBar`)       |
| `sidebar.header` | `AppShell.Sidebar`, after the `header` prop  |
| `sidebar.footer` | `AppShell.Sidebar`, before the `footer` prop |

A plugin contributes with `ui/slots/<slot>.tsx` (order with `export const order`). The sidebar
slots are not rendered in the navbar layout; contributions that must always be visible belong
in `app-bar.end`. The package manifest declares the three slots under `bitakit.slots`.

## Appearance settings

Shell declares one settings section, "Appearance" (category `appearance`). Labels come from
`shell.settings.*` in the Shell locales.

| Key             | Scope  | Default       | Values                                                                | Applied as                       |
| --------------- | ------ | ------------- | --------------------------------------------------------------------- | -------------------------------- |
| `shell.mode`    | device | `system`      | `light`, `dark`, `system`                                             | `dark` class and `color-scheme`  |
| `shell.layout`  | user   | `sidebar`     | `sidebar`, `navbar`                                                   | `data-shell-layout` on the frame |
| `shell.preset`  | user   | `default`     | `default` and the configured presets                                  | `data-theme-preset`              |
| `shell.density` | user   | `comfortable` | `comfortable`, `compact`                                              | `data-density`                   |
| `shell.corners` | user   | `default`     | `default`, `round`, `square`                                          | `data-shell-corners`             |
| `shell.toasts`  | device | `bottom`      | `top start`, `top`, `top end`, `bottom start`, `bottom`, `bottom end` | Toast region placement           |

`shell.preset` exists only when presets are configured. Read and write them like any setting:
`useSetting('shell.layout')`, `settings.shell.mode.get()` in services and actions. The Shell
theme provider sets the class and attributes on `<html>` once values are loaded for the current
identity, follows the system color scheme for `system`, and restores the previous document
state when it unmounts.
`@bitakit/ui/theme.css` styles `data-shell-corners`; the CSS for density and presets comes from
the theme that defines them.

### Theme presets

A preset is CSS, shipped by the host or a package, that overrides the theme tokens under
`[data-theme-preset="<id>"]`. Shell ships none besides `default` (the base tokens). Declare
each preset in the `presets` option; its `label` names it in the settings, and a
`shell.settings.preset.options.<id>` translation wins when a catalog defines one.

```css
:root[data-theme-preset='ocean'] {
  --primary: oklch(0.55 0.15 230);
  --primary-foreground: oklch(0.98 0 0);
}
:root.dark[data-theme-preset='ocean'] {
  --primary: oklch(0.7 0.13 230);
}
```

## Pre-paint script

`ShellThemeScript` renders an inline script for `<head>` that applies the stored color scheme
before React hydrates, so dark mode does not flash. It reads the default browser storage of
`shell.mode` (`localStorage['bitakit.settings.device/shell.mode']`, JSON) and falls back to the
system preference. Pass `nonce` under a content security policy. With a server-backed
`settings.storage`, the system scheme applies until the value has loaded.

## Notifications

`app.services.notifications` (contract `notificationService`) shows notifications on HeroUI's
toast queue, the queue that native HeroUI and Better Auth UI components use as well:

```ts
const id = services.notifications.show('files.saved', {
  type: 'success', // 'success' | 'error' | 'info' | 'warning'
  description: 'files.savedDetails',
  values: { name },
  duration: 5000, // milliseconds; 0 keeps it open
});
services.notifications.dismiss(id);
```

Messages and descriptions resolve as translation keys through `i18n` when one is installed;
plain text passes through. In components, `useNotifications()` returns the service once the
runtime is ready. Shell renders the one toast region at the `shell.toasts` placement and routes
action feedback (`success`/`failure` messages) through the same service. Do not pass `notify`
to `FoundationProvider` or render a second `Toast.Provider`.

## Page states

`NotFoundPage`, `ErrorPage`, `LoadingPage` and `AccessDeniedPage` (also from
`@bitakit/shell/pages`) render titled empty states without providers or routing. `ErrorPage`
takes `reset`; children are host-owned links and controls. Use the framework's not-found route
to set the HTTP status.

## Entries

| Entry                           | Content                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bitakit/shell`                | `AppShell`, `useShellLayout`, `useNotifications`, `notificationService`, `ShellThemeScript`, `shellPlugin`, `shellOptions`, page states, types |
| `@bitakit/shell/foundation`     | `shellPlugin` as the default export, for discovery                                                                                             |
| `@bitakit/shell/pages`          | The page states                                                                                                                                |
| `@bitakit/shell/styles.css`     | HeroUI styles, the theme's dark variant and the package sources                                                                                |
| `@bitakit/shell/locales/*.json` | `shell.settings`, `shell.ui` and `shell.pages` catalogs                                                                                        |

## Source responsibilities

| Path                                 | Responsibility                                                  |
| ------------------------------------ | --------------------------------------------------------------- |
| `src/plugin.tsx`                     | `shellPlugin`: settings, notification service, providers        |
| `src/options.ts`                     | `ShellOptions`, the `shellOptions` schema and option validation |
| `src/appearance.ts`                  | The Appearance settings declaration                             |
| `src/services/notifications.ts`      | Notification contract and translation at the service boundary   |
| `src/ui/notification-queue.ts`       | The HeroUI toast queue implementation of the contract           |
| `src/ui/providers/theme.tsx`         | Theme projection onto `<html>` and `ShellThemeScript`           |
| `src/ui/providers/notifications.tsx` | Toast region and the runtime notifier                           |
| `src/ui/use-notifications.ts`        | `useNotifications`                                              |
| `src/components/app-shell.tsx`       | `AppShell`, its parts, page layouts and `useShellLayout`        |
| `src/components/page-states.tsx`     | Standalone page states                                          |
| `src/components/ui/empty.tsx`        | The standard empty-state component used by the page states      |
