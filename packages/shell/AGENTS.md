# @bitakit/shell — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/shell`). To
> change the package itself, follow the repository's own AGENTS.md instead.

Shell is the application frame: sidebar or navbar navigation, header, page surface, appearance
settings (color scheme, themes, layout, density, corners), toast notifications and page states.
It is a discovered plugin with the ID `shell`; create-app installs it by default.

## Setup an app already has

- `src/app/(app)/layout.tsx` renders `<AppShell>{children}</AppShell>`; the root layout renders
  `<ShellThemeScript />` in `<head>`. Do not add another frame or theme provider.
- `src/configs/shell.ts` holds the options: `navigationSlot` (default `shell.navigation`),
  `themes` (extra theme objects) and `presets` (CSS presets). Unknown keys fail with their name.
- Shell's settings render under Settings → Themes (`/settings/shell`) and Layout
  (`/settings/shell/layout`) when `@bitakit/app-preferences` is installed.

## What it provides

| Kind     | IDs                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services | `notifications` (`show(message, { type, description, duration })`, `dismiss(id)`), `themes`                                                                    |
| Actions  | `shell.selectTheme`, `shell.saveThemeCopy`, `shell.updateTheme`, `shell.deleteTheme`, `shell.testNotification`                                                 |
| Settings | `shell.mode` (device), `shell.layout`, `shell.density`, `shell.corners`, `shell.toasts` (device), `shell.themeLibrary` (hidden), `shell.preset` (with presets) |
| Hooks    | `useShellLayout()`, `useNotifications()`                                                                                                                       |
| Pages    | `NotFoundPage`, `ErrorPage`, `AccessDeniedPage`, `LoadingPage`, `PageState` from `@bitakit/shell/pages`                                                        |

## Put things into the frame (list slots)

| Slot                                              | Accepts   | Where                                     |
| ------------------------------------------------- | --------- | ----------------------------------------- |
| `shell.navigation`                                | Actions   | Sidebar menu, or the top menu in navbar   |
| `shell.toolbar`                                   | Actions   | Header, right side                        |
| `shell.header.start` / `.center` / `.end`         | component | Header regions, both layouts              |
| `app-bar.end`                                     | component | Header, right, before the toolbar         |
| `shell.content.before` / `.after`, `shell.footer` | component | Around every page                         |
| `sidebar.header` / `.body` / `.footer`            | component | Sidebar layout only (`{ collapsed }`)     |
| `shell.brand`                                     | component | Sidebar header, navbar start, auth layout |

A navigation link is an Action: `defineAction({ title: 'Notes', href: '/notes', slots: ['shell.navigation'] })`.
A header widget is a file `src/plugins/<id>/ui/slots/shell.header.end.tsx`. Content that must
show in both layouts goes into header or content slots; `sidebar.*` does not render in navbar.

## Replace parts (single slots)

Each part renders Shell's default until one contribution replaces it. Write the file and it
wins; the app's own file wins over plugins; with several candidates, choose in
`bitakit.config.ts`: `choose: { 'layout.auth': 'split' }`.

| Part               | Replace with                                                         | Default                           |
| ------------------ | -------------------------------------------------------------------- | --------------------------------- |
| `layout.app`       | `src/layouts/app.tsx`: the whole frame for normal pages              | Sidebar or navbar                 |
| `layout.auth`      | `src/layouts/auth.tsx` or `src/layouts/auth/<variant>.tsx`           | Centered column with the brand    |
| `layout.error`     | `src/layouts/error.tsx`                                              | Centered page, no navigation      |
| `layout.full-page` | `src/layouts/full-page.tsx`                                          | Page spacing, no frame            |
| `screen.not-found` | `ui/slots/screen.not-found.tsx` (app `src/ui/slots/...` or a plugin) | "Page not found"                  |
| `screen.error`     | `ui/slots/screen.error.tsx`; receives `{ payload: { reset } }`       | "Something went wrong", Try again |
| `screen.forbidden` | `ui/slots/screen.forbidden.tsx`                                      | "Access denied"                   |
| `screen.loading`   | `ui/slots/screen.loading.tsx`                                        | "Loading"                         |

- Pages pick a family with `export const layout = 'auth'` (also `'error'`, `'full-page'`,
  `'blank'` for a bare page, or any family the app adds under `src/layouts/<family>/`).
- A layout receives `{ children }`, the page; it can compose `AppShell.Sidebar`,
  `AppShell.TopBar`, `AppShell.Content`, `AppShell.AuthLayout` and `AppShell.ErrorLayout`.
- Framework files pass the family directly: `<AppShell layout="error"><NotFoundPage /></AppShell>`.
- A screen replacement renders wherever the page state renders (catch-all route, `error.tsx`,
  `not-found.tsx`) and replaces the call-site title and description too.
- `npx bitakit add layout auth/split` scaffolds a layout; `npx bitakit slots` shows which
  candidate renders each part.

## Themes

A theme is JSON in `src/themes/<id>.json` with `$schema`
`https://unpkg.com/@bitakit/shell/dist/theme.schema.json`; see "Theme files" in the README.
Change colors in pairs (`primary` and `primary-foreground`) for light and dark; no `url()`.
Users also download and import theme files on the Themes page.

## Rules

- Read and write appearance through settings (`useSetting('shell.layout')`), never the DOM.
- Show messages with `useNotifications().show(...)` or an Action's `success`/`failure`.
- Do not wrap pages in a second `AppShell`; layouts may render one when they need the frame.
- Use the standard components from `@bitakit/ui/components` and the theme tokens; no local styles.

## More

README sections: AppShell, Slots, Appearance settings, Theme files, Notifications, Page states.
