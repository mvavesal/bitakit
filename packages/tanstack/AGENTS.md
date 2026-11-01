# @bitakit/tanstack — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/tanstack`).
> To change the package itself, follow the repository's own AGENTS.md instead.

The TanStack Start adapter (experimental), used instead of `@bitakit/next`: it runs discovery
from Vite and connects the BitaKit provider to TanStack Router and nuqs.

## The wiring an app has

- `vite.config.ts`: `bitakit()` from `@bitakit/tanstack/config` before `tanstackStart()`; it
  regenerates `src/bitakit.gen.*` while files change. Never edit the generated files.
- The root route renders `BitaKitProvider` from `./bitakit.gen` around `<Outlet />` and keeps
  `HeadContent` and `Scripts`; `src/bitakit.gen.css` is imported once.
- A catch-all route (`$`) renders plugin pages with `<PluginPage />`; Settings use a
  `settings.$` route with `<SettingsRoute />`.

## Rules

- Plugin code is identical to a Next.js app; only the framework files differ.
- Keep native routes for server work; plugin pages render in the browser.
